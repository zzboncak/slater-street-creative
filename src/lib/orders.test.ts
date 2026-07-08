import { describe, it, expect, vi } from "vitest";
import { expireStalePendingOrders } from "./orders";

function makeDb(count: number) {
  const updateMany = vi.fn().mockResolvedValue({ count });
  const db = { order: { updateMany } } as unknown as Parameters<
    typeof expireStalePendingOrders
  >[0];
  return { db, updateMany };
}

describe("expireStalePendingOrders", () => {
  const now = new Date("2026-07-08T12:00:00Z");

  it("expires PENDING orders older than the cutoff and returns the count", async () => {
    const { db, updateMany } = makeDb(3);
    const expired = await expireStalePendingOrders(db, 24, now);
    expect(expired).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date("2026-07-07T12:00:00Z") }, // now − 24h
      },
      data: { status: "EXPIRED" },
    });
  });

  it("computes the cutoff from the given window", async () => {
    const { updateMany } = makeDb(0);
    const db = { order: { updateMany } } as unknown as Parameters<
      typeof expireStalePendingOrders
    >[0];
    await expireStalePendingOrders(db, 1, now);
    expect(updateMany.mock.calls[0][0].where.createdAt.lt).toEqual(
      new Date("2026-07-08T11:00:00Z"), // now − 1h
    );
  });

  it("returns 0 when nothing is stale", async () => {
    const { db } = makeDb(0);
    expect(await expireStalePendingOrders(db, 24, now)).toBe(0);
  });
});
