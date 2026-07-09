import type { Coupon, PrismaClient } from "@prisma/client";
import { computeDiscountCents, couponValidNow } from "@/lib/pricing";

// Accepts either the global prisma client or an interactive transaction client
// (`tx`) — both expose a `.coupon` delegate. Kept narrow so the resolver can run
// inside or outside a transaction without caring which.
type CouponDb = Pick<PrismaClient, "coupon">;

// One place that turns a coupon code into a discount against a subtotal, reading
// from the DB. Callers decide how to react to the result:
//   - /api/cart maps it to a SOFT CouponStatus (invalid → full price + message)
//   - /api/checkout maps `ok:false` to a HARD 400 and reads `coupon` for the
//     order snapshot.
// The math/validity primitives stay in the DB-free pricing.ts; this module only
// adds the DB orchestration (lookup + normalization).
export type CouponResolution =
  | { ok: true; discountCents: number; coupon: Coupon }
  | { ok: false; reason: "not_found" | "not_valid" | "exhausted" };

export async function resolveCoupon(
  db: CouponDb,
  code: string,
  subtotalCents: number,
): Promise<CouponResolution> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, reason: "not_found" };

  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  if (!coupon) return { ok: false, reason: "not_found" };
  if (!couponValidNow(coupon, new Date())) {
    return { ok: false, reason: "not_valid" };
  }
  // Read-side global-cap check — for UX (cart soft-preview) and an early checkout
  // reject. The AUTHORITATIVE guard is the atomic claim at checkout below; this
  // just avoids offering a code that's already spent (SSC-30).
  if (
    coupon.maxRedemptions != null &&
    coupon.usedCount >= coupon.maxRedemptions
  ) {
    return { ok: false, reason: "exhausted" };
  }

  return {
    ok: true,
    discountCents: computeDiscountCents(subtotalCents, coupon),
    coupon,
  };
}

/**
 * Atomically reserve one redemption of a coupon (SSC-30). The compare-and-set
 * (`usedCount < maxRedemptions` + increment) is a single UPDATE, so concurrent
 * checkouts serialize on the row and a capped coupon can never be over-redeemed —
 * the same primitive as inventory decrement and order-status transitions. An
 * uncapped coupon (null `maxRedemptions`) always succeeds but still bumps
 * `usedCount`, so the counter stays meaningful for the admin burn-down and the
 * per-user check. Returns false when the cap is already reached (caller rejects
 * with `coupon_exhausted`). Call inside the order transaction so a later failure
 * rolls the reservation back.
 */
export async function claimCouponRedemption(
  db: CouponDb,
  couponId: string,
  maxRedemptions: number | null,
): Promise<boolean> {
  const res = await db.coupon.updateMany({
    where: {
      id: couponId,
      ...(maxRedemptions != null ? { usedCount: { lt: maxRedemptions } } : {}),
    },
    data: { usedCount: { increment: 1 } },
  });
  return res.count > 0;
}

/**
 * Release a previously-reserved redemption when an order that reserved it leaves
 * without a sale — the EXPIRED sweep or the CANCELLED (async-payment-failed)
 * path (SSC-30). Atomic and floored at 0 (`usedCount > 0` guard) so retries or a
 * double-fire can't drive it negative. No-op if the coupon is gone.
 */
export async function releaseCouponRedemption(
  db: CouponDb,
  code: string,
): Promise<void> {
  await db.coupon.updateMany({
    where: { code, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}
