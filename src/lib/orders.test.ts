import { describe, it, expect, vi } from "vitest";
import { expireStalePendingOrders, markOrderFulfilled } from "./orders";

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

describe("markOrderFulfilled", () => {
  it("transitions a PAID order to FULFILLED (status only) and returns true", async () => {
    const { db, updateMany } = makeDb(1);
    expect(await markOrderFulfilled(db, "ord_1")).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "ord_1", status: "PAID" },
      data: { status: "FULFILLED" },
    });
  });

  it("is a no-op (returns false) for a non-PAID order", async () => {
    // updateMany matches 0 rows when the order isn't PAID (PENDING/FULFILLED/etc).
    const { db } = makeDb(0);
    expect(await markOrderFulfilled(db, "ord_1")).toBe(false);
  });

  it("only ever changes status — no money fields in the update", async () => {
    const { db, updateMany } = makeDb(1);
    await markOrderFulfilled(db, "ord_1");
    expect(Object.keys(updateMany.mock.calls[0][0].data)).toEqual(["status"]);
  });
});
