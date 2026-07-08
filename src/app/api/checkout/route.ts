import { NextResponse } from "next/server";
import type { OrderStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { checkoutEnabled, ecommerceEnabled } from "@/lib/flags";
import { normalizeRequestedItems, classifyTotal } from "@/lib/pricing";
import { resolveCoupon } from "@/lib/coupons";
import {
  decrementInventoryForItems,
  classifyExistingCheckout,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

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

type CheckoutLine = {
  productId: string | null;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

// The transaction's normalized result, whether the order was freshly created or
// an idempotent retry resolved to an existing one (SSC-28).
type CheckoutResult = {
  orderId: string;
  lineData: CheckoutLine[];
  discountCents: number;
  couponSnapshotCode: string | null;
  isFree: boolean;
  // The token resolved to an already-settled order (PAID/SHIPPED/FULFILLED) —
  // a retry after payment. Nothing to charge; redirect to the confirmation.
  alreadyPaid: boolean;
};

// Rebuild the checkout result from an order this token already resolved to (an
// idempotent retry, SSC-28). A settled order needs no Stripe work; a still-
// PENDING one has its line items rebuilt from the snapshot so the original
// Stripe session is replayed via the same per-order idempotency key.
async function resolveExistingOrder(
  db: Pick<PrismaClient, "orderItem">,
  existing: {
    id: string;
    status: OrderStatus;
    discountCents: number;
    couponCode: string | null;
  },
): Promise<CheckoutResult> {
  const decision = classifyExistingCheckout(existing);
  if (decision.kind === "paid") {
    return {
      orderId: existing.id,
      lineData: [],
      discountCents: 0,
      couponSnapshotCode: null,
      isFree: false,
      alreadyPaid: true,
    };
  }
  const items = await db.orderItem.findMany({
    where: { orderId: existing.id },
  });
  return {
    orderId: existing.id,
    lineData: items.map((i) => ({
      productId: i.productId,
      name: i.name,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.lineTotalCents,
    })),
    discountCents: existing.discountCents,
    couponSnapshotCode: existing.couponCode,
    isFree: false,
    alreadyPaid: false,
  };
}

// True for a Prisma unique-constraint violation on checkoutToken — i.e. a
// concurrent double-submit lost the race to create this token's order.
function isCheckoutTokenRace(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === "P2002" &&
    String((e as { meta?: { target?: unknown } }).meta?.target ?? "").includes(
      "checkoutToken",
    )
  );
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
  // Money path — fail closed. Taking a payment requires BOTH the commerce
  // surface AND checkout to be enabled, enforced server-side (not just config
  // discipline), so a hidden button is never the only protection.
  if (!ecommerceEnabled() || !checkoutEnabled()) {
    return NextResponse.json(
      { error: "Checkout is not available.", code: "checkout_disabled" },
      { status: 404 },
    );
  }

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

  // Optional client idempotency token (SSC-28). Bounded length; anything else is
  // treated as absent, which falls back to the pre-SSC-28 always-create path.
  const checkoutToken =
    typeof body?.checkoutToken === "string" &&
    body.checkoutToken.length > 0 &&
    body.checkoutToken.length <= 100
      ? body.checkoutToken
      : null;

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      // Idempotent retry (SSC-28): if this token already has an order, replay it
      // instead of minting a duplicate. Runs before any re-pricing or creation.
      if (checkoutToken) {
        const existing = await tx.order.findUnique({
          where: { checkoutToken },
          select: {
            id: true,
            status: true,
            email: true,
            customerId: true,
            discountCents: true,
            couponCode: true,
          },
        });
        if (existing) {
          // Scope reuse to the token's owner. UUID tokens are unguessable, so a
          // mismatch is effectively impossible — but never let one caller's
          // token resolve to another user's order.
          const owned =
            existing.email === user.email ||
            (!!user.customerId && existing.customerId === user.customerId);
          if (!owned) {
            throw new CheckoutError(
              409,
              "checkout_conflict",
              "Please try checking out again.",
            );
          }
          if (classifyExistingCheckout(existing).kind === "stale") {
            throw new CheckoutError(
              409,
              "checkout_expired",
              "Your checkout session expired. Please try again.",
            );
          }
          return resolveExistingOrder(tx, existing);
        }
      }

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
        const result = await resolveCoupon(tx, couponCode, subtotalCents);
        if (!result.ok) {
          throw new CheckoutError(
            400,
            "invalid_coupon",
            "That coupon code is not valid.",
          );
        }
        discountCents = result.discountCents;
        couponPercentOff = result.coupon.percentOff;
        couponAmountOff = result.coupon.amountOff;
        couponSnapshotCode = result.coupon.code;
      }

      const totalCents = Math.max(0, subtotalCents - discountCents);
      const outcome = classifyTotal(totalCents);

      // 1–49¢: Stripe can't charge it and it isn't free. Block with a clear
      // message (no orphan order — we throw before creating one).
      if (outcome === "below_minimum") {
        throw new CheckoutError(
          400,
          "below_minimum",
          "Your order total is below the $0.50 minimum we can process.",
        );
      }

      const isFree = outcome === "free";

      // A chargeable order needs Stripe configured; reject before creating the
      // order so a misconfiguration can't leave an orphan PENDING order. A free
      // order needs no charge, so it doesn't require Stripe at all.
      if (!isFree && !getStripe()) {
        throw new CheckoutError(
          503,
          "payments_unconfigured",
          "Payments are not configured.",
        );
      }

      const order = await tx.order.create({
        data: {
          customerId: user.customerId ?? null,
          email: user.email,
          // A free order is settled on creation ("paid" for $0); a chargeable
          // one stays PENDING until the Stripe webhook confirms payment.
          status: isFree ? "PAID" : "PENDING",
          subtotalCents,
          discountCents,
          totalCents,
          couponCode: couponSnapshotCode,
          couponPercentOff,
          couponAmountOff,
          // The unique token lets a retry find this exact order (SSC-28).
          checkoutToken,
          items: { create: lineData },
        },
        select: { id: true },
      });

      // Free order: no payment webhook will ever fire, so commit inventory now
      // (the chargeable path defers this to the webhook on the paid event).
      if (isFree) {
        await decrementInventoryForItems(tx, lineData, order.id);
      }

      return {
        orderId: order.id,
        lineData,
        discountCents,
        couponSnapshotCode,
        isFree,
        alreadyPaid: false,
      };
    });
  } catch (e) {
    if (e instanceof CheckoutError) {
      return NextResponse.json(
        { error: e.message, code: e.code, ...e.data },
        { status: e.status },
      );
    }
    // Concurrent double-submit (SSC-28): two in-flight requests with the same
    // token both passed the find-then-create gap and one lost on the unique
    // index. Resolve to the winner's order instead of 500-ing.
    if (checkoutToken && isCheckoutTokenRace(e)) {
      const existing = await prisma.order.findUnique({
        where: { checkoutToken },
        select: {
          id: true,
          status: true,
          discountCents: true,
          couponCode: true,
        },
      });
      if (
        existing &&
        existing.status !== "CANCELLED" &&
        existing.status !== "EXPIRED"
      ) {
        created = await resolveExistingOrder(prisma, existing);
      } else {
        throw e;
      }
    } else {
      throw e; // unexpected → 500
    }
  }

  // Idempotent retry that resolved to an already-settled order (PAID/SHIPPED/
  // FULFILLED): nothing to charge — send them back to the confirmation page.
  if (created.alreadyPaid) {
    return NextResponse.json(
      { url: `/thank-you?order=${created.orderId}`, orderId: created.orderId },
      { status: 200 },
    );
  }

  // Free order ($0 after a full-value coupon): already PAID with inventory
  // committed — no charge to collect. Send the browser straight to the
  // confirmation page (reuses the cart button's `{ url }` redirect).
  if (created.isFree) {
    return NextResponse.json(
      { url: `/thank-you?order=${created.orderId}`, orderId: created.orderId },
      { status: 201 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    // Chargeable orders check this inside the transaction; this is a safety net
    // (the PENDING order would be swept by the daily cron if it ever hits).
    return NextResponse.json(
      { error: "Payments are not configured.", code: "payments_unconfigured" },
      { status: 503 },
    );
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
