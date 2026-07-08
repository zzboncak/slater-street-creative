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
  | { ok: false; reason: "not_found" | "not_valid" };

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

  return {
    ok: true,
    discountCents: computeDiscountCents(subtotalCents, coupon),
    coupon,
  };
}
