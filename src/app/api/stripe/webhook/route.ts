import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { decrementInventoryForItems } from "@/lib/orders";
import { releaseCouponRedemption } from "@/lib/coupons";
import { sendOrderConfirmation } from "@/lib/email";

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

  // Card payments arrive as `completed` + `payment_status: "paid"`. Async
  // methods (bank debits etc.) arrive as `completed` + `unpaid` first, then a
  // separate async_payment_succeeded / async_payment_failed. All three carry a
  // Checkout Session as their data object.
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (event.type === "checkout.session.async_payment_failed") {
      // Definitive failure — cancel the order; never touch inventory.
      if (orderId) await cancelPendingOrder(orderId);
      else
        console.warn(
          `[stripe-webhook] ${event.type} for session ${session.id} had no orderId metadata`,
        );
    } else {
      // completed or async_payment_succeeded. Treat as paid only when the
      // session is actually paid: a `completed` event for an unpaid async
      // session does nothing here (its async_payment_succeeded follows).
      const isPaid =
        event.type === "checkout.session.async_payment_succeeded" ||
        session.payment_status === "paid";
      if (isPaid && orderId) {
        await fulfillPaidOrder(orderId);
      } else if (isPaid && !orderId) {
        console.warn(
          `[stripe-webhook] paid ${event.type} for session ${session.id} had no orderId metadata`,
        );
      }
    }
  }

  // Ack everything (handled or ignored) so Stripe doesn't retry needlessly.
  return NextResponse.json({ received: true });
}

/**
 * Mark a PENDING order CANCELLED (e.g. an async payment definitively failed).
 * Compare-and-set so it's idempotent and can't override a PAID transition; never
 * touches inventory — a PENDING order never decremented stock.
 */
async function cancelPendingOrder(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { couponCode: true },
    });
    const res = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (res.count > 0) {
      // Only the delivery that won the PENDING→CANCELLED flip releases the
      // coupon slot the order reserved at checkout (SSC-30) — so a retried
      // webhook can't double-release.
      if (order?.couponCode)
        await releaseCouponRedemption(tx, order.couponCode);
      console.info(
        `[stripe-webhook] order ${orderId} CANCELLED (async payment failed)`,
      );
    }
  });
}

/**
 * Mark an order PAID and decrement inventory, atomically and idempotently.
 * The compare-and-set on status (`updateMany where status = PENDING`) is the
 * idempotency lock: only the delivery that wins the PENDING→PAID flip touches
 * inventory, so webhook retries (or concurrent deliveries) never double-decrement.
 */
async function fulfillPaidOrder(orderId: string) {
  const fulfilled = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID" },
    });
    if (claimed.count === 0) {
      // Not PENDING: usually an idempotent replay of an already-PAID order. But
      // a paid webhook for a CANCELLED/EXPIRED order means money came in with
      // nothing to fulfill — surface it for manual refund/reconciliation.
      const existing = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (existing?.status === "CANCELLED" || existing?.status === "EXPIRED") {
        console.warn(
          `[stripe-webhook] paid webhook for ${existing.status} order ${orderId} — needs manual reconciliation/refund`,
        );
      }
      return null; // already fulfilled by a prior delivery — don't re-send
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        email: true,
        subtotalCents: true,
        discountCents: true,
        totalCents: true,
        couponCode: true,
      },
    });
    const items = await tx.orderItem.findMany({ where: { orderId } });
    await decrementInventoryForItems(tx, items, orderId);
    return { order, items };
  });

  // Only the delivery that won the PENDING→PAID flip reaches here (retries
  // returned null above), so the receipt is sent at most once. Best-effort and
  // AWAITed (a serverless function can be frozen after responding, dropping a
  // fire-and-forget send): a failure is logged but must never fail fulfillment —
  // the order is already PAID with inventory committed (SSC-18).
  if (fulfilled?.order) {
    try {
      await sendOrderConfirmation(fulfilled.order, fulfilled.items);
    } catch (err) {
      console.error(
        `[stripe-webhook] order ${orderId} confirmation email failed (order still fulfilled):`,
        err,
      );
    }
  }
}
