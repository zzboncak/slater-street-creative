import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import {
  normalizeRequestedItems,
  computeDiscountCents,
  couponValidNow,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Stripe's minimum charge for USD is $0.50. A total below this (including $0
// from a full-value coupon) can't create a payable Checkout Session, so we
// reject it up front rather than committing an order that could never be paid.
const MIN_CHARGE_CENTS = 50;

// Thrown inside the transaction to abort it and map to an HTTP response.
class CheckoutError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

/**
 * Checkout: re-price the cart from the DB, validate inventory and any coupon,
 * create a PENDING order, then hand off to Stripe-hosted Checkout for payment.
 * The client sends only { items: [{productId, quantity}], couponCode? } and
 * never any prices. Requires an authenticated session (the order's
 * email/customer come from it). Inventory is validated but NOT decremented
 * here; stock is committed when payment is confirmed (webhook, later ticket).
 *
 * Returns { url } — the Stripe Checkout URL to redirect the browser to.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to check out.", code: "auth_required" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const wanted = normalizeRequestedItems(body);
  if (wanted.size === 0) {
    return NextResponse.json(
      { error: "Your cart is empty.", code: "empty_cart" },
      { status: 400 },
    );
  }
  const couponCode =
    typeof body?.couponCode === "string"
      ? body.couponCode.trim().toUpperCase()
      : null;

  // Fail before creating an order if payments aren't configured, so we never
  // leave an orphan PENDING order that can't be paid.
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Payments are not configured.", code: "payments_unconfigured" },
      { status: 503 },
    );
  }

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const ids = [...wanted.keys()];
      const products = await tx.product.findMany({
        where: { id: { in: ids }, active: true },
        include: { inventory: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      // Every requested product must exist and be active.
      const unavailable = ids.filter((id) => !byId.has(id));
      if (unavailable.length) {
        throw new CheckoutError(
          409,
          "unavailable",
          "Some items are no longer available.",
          { productIds: unavailable },
        );
      }

      // Re-price from the DB and snapshot name/price onto each line.
      const insufficient: string[] = [];
      const lineData = ids.map((id) => {
        const p = byId.get(id)!;
        const quantity = wanted.get(id)!;
        const stock = p.inventory?.quantity ?? 0;
        if (quantity > stock) insufficient.push(id);
        return {
          productId: p.id,
          name: p.name,
          unitPriceCents: p.priceCents,
          quantity,
          lineTotalCents: p.priceCents * quantity,
        };
      });
      if (insufficient.length) {
        throw new CheckoutError(
          409,
          "insufficient_stock",
          "There isn't enough stock for some items.",
          { productIds: insufficient },
        );
      }

      const subtotalCents = lineData.reduce((s, l) => s + l.lineTotalCents, 0);

      // Optional coupon: must exist, be active, and be within its date window.
      let discountCents = 0;
      let couponPercentOff: number | null = null;
      let couponAmountOff: number | null = null;
      let couponSnapshotCode: string | null = null;
      if (couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: couponCode },
        });
        if (!coupon || !couponValidNow(coupon, new Date())) {
          throw new CheckoutError(
            400,
            "invalid_coupon",
            "That coupon code is not valid.",
          );
        }
        discountCents = computeDiscountCents(subtotalCents, coupon);
        couponPercentOff = coupon.percentOff;
        couponAmountOff = coupon.amountOff;
        couponSnapshotCode = coupon.code;
      }

      const totalCents = Math.max(0, subtotalCents - discountCents);

      // Reject before creating the order (fail-closed, no orphan PENDING order)
      // if the discounted total is below what Stripe can charge. Free/near-free
      // orders (e.g. a 100%-off coupon) need dedicated handling — see follow-up.
      if (totalCents < MIN_CHARGE_CENTS) {
        throw new CheckoutError(
          400,
          "below_minimum",
          "Your order total is below the $0.50 minimum we can process.",
        );
      }

      const order = await tx.order.create({
        data: {
          customerId: user.customerId ?? null,
          email: user.email,
          status: "PENDING",
          subtotalCents,
          discountCents,
          totalCents,
          couponCode: couponSnapshotCode,
          couponPercentOff,
          couponAmountOff,
          items: { create: lineData },
        },
        select: { id: true },
      });

      return { orderId: order.id, lineData, discountCents, couponSnapshotCode };
    });
  } catch (e) {
    if (e instanceof CheckoutError) {
      return NextResponse.json(
        { error: e.message, code: e.code, ...e.data },
        { status: e.status },
      );
    }
    throw e; // unexpected → 500
  }

  // Build a Stripe Checkout Session from the SERVER-computed line items and
  // discount. Idempotency keys (scoped to the order id) make a retry reuse the
  // same coupon/session instead of creating duplicates.
  // Prefer the configured first-party SITE_URL so redirect targets are
  // deterministic; fall back to the request origin for local dev.
  const origin =
    process.env.SITE_URL ||
    req.headers.get("origin") ||
    new URL(req.url).origin;

  try {
    const discounts: { coupon: string }[] = [];
    if (created.discountCents > 0) {
      const coupon = await stripe.coupons.create(
        {
          amount_off: created.discountCents,
          currency: "usd",
          duration: "once",
          name: created.couponSnapshotCode ?? "Discount",
        },
        { idempotencyKey: `coupon_${created.orderId}` },
      );
      discounts.push({ coupon: coupon.id });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        // Omit payment_method_types → dynamic payment methods (managed in the
        // Stripe Dashboard), which maximizes conversion.
        line_items: created.lineData.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: "usd",
            unit_amount: l.unitPriceCents,
            product_data: { name: l.name },
          },
        })),
        ...(discounts.length ? { discounts } : {}),
        // Only prefill a real email; the seeded admin login ("admin") isn't one.
        ...(user.email.includes("@") ? { customer_email: user.email } : {}),
        client_reference_id: created.orderId,
        metadata: { orderId: created.orderId },
        success_url: `${origin}/thank-you?order=${created.orderId}`,
        cancel_url: `${origin}/cart`,
      },
      { idempotencyKey: `session_${created.orderId}` },
    );

    await prisma.order.update({
      where: { id: created.orderId },
      data: { stripeCheckoutSessionId: session.id },
    });

    return NextResponse.json(
      { url: session.url, orderId: created.orderId },
      { status: 201 },
    );
  } catch {
    // The PENDING order exists but payment couldn't start. Leave it (it can be
    // retried/cleaned up) and tell the client to try again.
    return NextResponse.json(
      {
        error: "Could not start payment. Please try again.",
        code: "stripe_error",
      },
      { status: 502 },
    );
  }
}
