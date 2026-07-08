// Pure, dependency-free pricing/validation helpers shared by the cart and
// checkout routes. No DB or framework imports here, so the money math is
// trivially unit-testable (see pricing.test.ts).

// Upper bound per line so a crafted request can't produce absurd totals.
export const MAX_QTY = 999;

/**
 * Parse an untrusted request body into a `Map<productId, quantity>`.
 * Keeps only string ids with a positive integer quantity, collapses duplicate
 * ids (summing), and clamps each line to MAX_QTY. Prices are never read.
 */
export function normalizeRequestedItems(body: unknown): Map<string, number> {
  const rawItems =
    body &&
    typeof body === "object" &&
    Array.isArray((body as Record<string, unknown>).items)
      ? (body as { items: unknown[] }).items
      : [];
  const wanted = new Map<string, number>();
  for (const it of rawItems) {
    if (!it || typeof it !== "object") continue;
    const productId = (it as Record<string, unknown>).productId;
    if (typeof productId !== "string") continue;
    const qty = Number((it as Record<string, unknown>).quantity);
    if (!Number.isInteger(qty) || qty < 1) continue;
    const next = Math.min((wanted.get(productId) ?? 0) + qty, MAX_QTY);
    wanted.set(productId, next);
  }
  return wanted;
}

export type CouponTerms = {
  percentOff: number | null;
  amountOff: number | null;
};

/**
 * Discount in integer cents for a given subtotal. `percentOff` takes precedence
 * over `amountOff` if both are set. The result is clamped to `[0, subtotal]` so
 * the order total can never go negative ("floor at 0").
 */
export function computeDiscountCents(
  subtotalCents: number,
  coupon: CouponTerms,
): number {
  if (subtotalCents <= 0) return 0;
  let discount = 0;
  if (coupon.percentOff != null) {
    discount = Math.floor((subtotalCents * coupon.percentOff) / 100);
  } else if (coupon.amountOff != null) {
    discount = coupon.amountOff;
  }
  if (discount < 0) return 0;
  if (discount > subtotalCents) return subtotalCents;
  return discount;
}

export type CouponWindow = {
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
};

/** A coupon is usable if it is active and `now` falls within its date window. */
export function couponValidNow(coupon: CouponWindow, now: Date): boolean {
  if (!coupon.active) return false;
  if (coupon.validFrom && now < coupon.validFrom) return false;
  if (coupon.validTo && now > coupon.validTo) return false;
  return true;
}

// Stripe's minimum charge for USD. A total below this can't create a payable
// Checkout Session.
export const MIN_CHARGE_CENTS = 50;

export type ChargeOutcome = "free" | "below_minimum" | "chargeable";

/**
 * How to handle an order total at checkout:
 *  - "free"          → $0 (a full-value coupon): create a PAID order, skip Stripe.
 *  - "below_minimum" → 1–49¢: Stripe can't charge it; block with a clear message.
 *  - "chargeable"    → ≥ 50¢: normal Stripe Checkout.
 */
export function classifyTotal(totalCents: number): ChargeOutcome {
  if (totalCents <= 0) return "free";
  if (totalCents < MIN_CHARGE_CENTS) return "below_minimum";
  return "chargeable";
}
