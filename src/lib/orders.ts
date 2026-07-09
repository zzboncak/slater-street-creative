import type { OrderStatus, PrismaClient } from "@prisma/client";
import { releaseCouponRedemption } from "@/lib/coupons";

// Accepts the global prisma client or a transaction client — both expose `.order`.
type OrderDb = Pick<PrismaClient, "order">;
type InventoryDb = Pick<PrismaClient, "inventory">;

/**
 * Decide what a checkout request should do when an order already exists for the
 * caller's idempotency token (SSC-28). Pure, so the branch logic is unit-tested:
 *  - null                     → no prior order; create a fresh one.
 *  - PENDING                  → reuse it (replay the Stripe session; no new order).
 *  - PAID / SHIPPED / FULFILLED → already settled; the retry is an idempotent
 *                               success (redirect straight to the confirmation).
 *  - CANCELLED / EXPIRED      → terminal (e.g. swept as abandoned long after the
 *                               attempt); the token is stale, so start over.
 */
export type CheckoutReuse =
  | { kind: "create" }
  | { kind: "reuse"; orderId: string }
  | { kind: "paid"; orderId: string }
  | { kind: "stale"; status: OrderStatus };

export function classifyExistingCheckout(
  existing: { id: string; status: OrderStatus } | null,
): CheckoutReuse {
  if (!existing) return { kind: "create" };
  switch (existing.status) {
    case "PENDING":
      return { kind: "reuse", orderId: existing.id };
    case "PAID":
    case "SHIPPED":
    case "FULFILLED":
      return { kind: "paid", orderId: existing.id };
    default: // CANCELLED / EXPIRED
      return { kind: "stale", status: existing.status };
  }
}

/**
 * Sweep abandoned checkouts: mark every PENDING order older than
 * `olderThanHours` as EXPIRED. A checkout mints a PENDING order before handing
 * off to Stripe, so abandoned payments / double-clicks / Stripe errors leave
 * orphans that only this sweep (not the paid webhook) resolves. Inventory is
 * untouched — PENDING orders never decremented stock. Any coupon slot the order
 * reserved at checkout is released (SSC-30). Idempotent: a second run matches
 * nothing new. Returns how many orders were expired.
 */
export async function expireStalePendingOrders(
  db: Pick<PrismaClient, "order" | "coupon">,
  olderThanHours: number,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanHours * 60 * 60 * 1000);
  // Read the stale orders first so we know which coupon slots to release.
  const stale = await db.order.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true, couponCode: true },
  });
  let expired = 0;
  for (const o of stale) {
    // Per-order compare-and-set: only flip orders still PENDING, so one paid
    // between the read and here is left alone and keeps its reservation — and
    // only an actual flip releases the coupon slot it reserved at checkout.
    const res = await db.order.updateMany({
      where: { id: o.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    if (res.count > 0) {
      expired++;
      if (o.couponCode) await releaseCouponRedemption(db, o.couponCode);
    }
  }
  return expired;
}

/**
 * Mark a PAID order FULFILLED. Compare-and-set on status — only a PAID order can
 * transition, and this touches nothing but `status`, so orders stay immutable
 * financial records (no money fields ever change). Returns whether it transitioned.
 */
export async function markOrderFulfilled(
  db: OrderDb,
  orderId: string,
): Promise<boolean> {
  const result = await db.order.updateMany({
    where: { id: orderId, status: "PAID" },
    data: { status: "FULFILLED" },
  });
  return result.count > 0;
}

/**
 * Decrement inventory for a set of order lines — atomic per line (so concurrent
 * orders for the same product can't lost-update), floored at 0 with a logged
 * oversell warning. Products deleted since the order (null productId) are skipped.
 * Shared by the paid webhook (SSC-14) and the free-order checkout path (SSC-23);
 * call it inside a transaction so it commits with the order's status change.
 */
export async function decrementInventoryForItems(
  db: InventoryDb,
  items: { productId: string | null; quantity: number }[],
  orderId: string,
): Promise<void> {
  for (const item of items) {
    if (!item.productId) continue; // product deleted; order snapshot stands
    const updated = await db.inventory.upsert({
      where: { productId: item.productId },
      update: { quantity: { decrement: item.quantity } },
      create: { productId: item.productId, quantity: 0 },
    });
    if (updated.quantity < 0) {
      console.warn(
        `[inventory] oversell on product ${item.productId} (order ${orderId}): ` +
          `short by ${-updated.quantity} — flooring at 0`,
      );
      await db.inventory.update({
        where: { productId: item.productId },
        data: { quantity: 0 },
      });
    }
  }
}
