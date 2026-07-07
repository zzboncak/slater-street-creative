import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook — the authoritative source of payment truth (never the browser
 * redirect). Verifies the signature, and on a paid `checkout.session.completed`
 * marks the order PAID and decrements inventory atomically and idempotently.
 *
 * Not gated by the commerce feature flags: Stripe authenticates via the webhook
 * signature, and a legitimate payment confirmation must always be recorded even
 * if checkout was toggled off after the session was created.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    // Misconfigured — we can't verify, so we must not act. 500 makes Stripe
    // retry once the secret is in place, rather than dropping the event.
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  // Signature verification needs the raw bytes — never req.json() here.
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (session.payment_status === "paid" && orderId) {
      await fulfillPaidOrder(orderId);
    } else if (session.payment_status === "paid" && !orderId) {
      console.warn(
        `[stripe-webhook] paid session ${session.id} had no orderId metadata`,
      );
    }
  }

  // Ack everything (handled or ignored) so Stripe doesn't retry needlessly.
  return NextResponse.json({ received: true });
}

/**
 * Mark an order PAID and decrement inventory, atomically and idempotently.
 * The compare-and-set on status (`updateMany where status = PENDING`) is the
 * idempotency lock: only the delivery that wins the PENDING→PAID flip touches
 * inventory, so webhook retries (or concurrent deliveries) never double-decrement.
 */
async function fulfillPaidOrder(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID" },
    });
    if (claimed.count === 0) {
      // Not PENDING: usually an idempotent replay of an already-PAID order. But
      // a paid webhook for a CANCELLED order means money came in with nothing to
      // fulfill — surface it for manual refund/reconciliation.
      const existing = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (existing?.status === "CANCELLED") {
        console.warn(
          `[stripe-webhook] paid webhook for CANCELLED order ${orderId} — needs manual reconciliation/refund`,
        );
      }
      return;
    }

    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      if (!item.productId) continue; // product deleted; order snapshot stands
      // Atomic decrement (SET quantity = quantity - n) — the DB row lock makes
      // concurrent orders for the same product serialize, so there's no
      // read-compute-write lost update. It can go negative on a genuine
      // oversell, which we then floor to 0 (still inside the row lock).
      const updated = await tx.inventory.upsert({
        where: { productId: item.productId },
        update: { quantity: { decrement: item.quantity } },
        create: { productId: item.productId, quantity: 0 },
      });
      if (updated.quantity < 0) {
        console.warn(
          `[stripe-webhook] oversell on product ${item.productId} (order ${orderId}): ` +
            `short by ${-updated.quantity} — flooring at 0`,
        );
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { quantity: 0 },
        });
      }
    }
  });
}
