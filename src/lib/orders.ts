import type { PrismaClient } from "@prisma/client";

// Accepts the global prisma client or a transaction client — both expose `.order`.
type OrderDb = Pick<PrismaClient, "order">;

/**
 * Sweep abandoned checkouts: mark every PENDING order older than
 * `olderThanHours` as EXPIRED. A checkout mints a PENDING order before handing
 * off to Stripe, so abandoned payments / double-clicks / Stripe errors leave
 * orphans that only this sweep (not the paid webhook) resolves. Inventory is
 * untouched — PENDING orders never decremented stock. Idempotent: a second run
 * matches nothing new. Returns how many orders were expired.
 */
export async function expireStalePendingOrders(
  db: OrderDb,
  olderThanHours: number,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanHours * 60 * 60 * 1000);
  const result = await db.order.updateMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    data: { status: "EXPIRED" },
  });
  return result.count;
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
