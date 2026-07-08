import type { PrismaClient } from "@prisma/client";

// Accepts the global prisma client or a transaction client — both expose `.order`.
type OrderDb = Pick<PrismaClient, "order">;
type InventoryDb = Pick<PrismaClient, "inventory">;

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
