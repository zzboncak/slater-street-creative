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
