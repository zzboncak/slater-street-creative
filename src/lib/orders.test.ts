import { describe, it, expect, vi } from "vitest";
import {
  expireStalePendingOrders,
  markOrderFulfilled,
  decrementInventoryForItems,
  classifyExistingCheckout,
} from "./orders";

function makeDb(count: number) {
  const updateMany = vi.fn().mockResolvedValue({ count });
  const db = { order: { updateMany } } as unknown as Parameters<
    typeof expireStalePendingOrders
  >[0];
  return { db, updateMany };
}

// A DB double for inventory.upsert/update; `quantitiesAfter` are the returned
// post-decrement quantities, one per upsert call in order.
function makeInvDb(quantitiesAfter: number[]) {
  const upsert = vi.fn();
  quantitiesAfter.forEach((q) => upsert.mockResolvedValueOnce({ quantity: q }));
  const update = vi.fn().mockResolvedValue({});
  const db = { inventory: { upsert, update } } as unknown as Parameters<
    typeof decrementInventoryForItems
  >[0];
  return { db, upsert, update };
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

describe("decrementInventoryForItems", () => {
  it("atomically decrements each line and doesn't floor when stock stays >= 0", async () => {
    const { db, upsert, update } = makeInvDb([7]);
    await decrementInventoryForItems(
      db,
      [{ productId: "p1", quantity: 3 }],
      "o",
    );
    expect(upsert).toHaveBeenCalledWith({
      where: { productId: "p1" },
      update: { quantity: { decrement: 3 } },
      create: { productId: "p1", quantity: 0 },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("floors at 0 with a follow-up update when a decrement goes negative", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, update } = makeInvDb([-2]); // oversell
    await decrementInventoryForItems(
      db,
      [{ productId: "p1", quantity: 5 }],
      "o",
    );
    expect(update).toHaveBeenCalledWith({
      where: { productId: "p1" },
      data: { quantity: 0 },
    });
    warn.mockRestore();
  });

  it("skips items whose product was deleted (null productId)", async () => {
    const { db, upsert } = makeInvDb([]);
    await decrementInventoryForItems(
      db,
      [{ productId: null, quantity: 2 }],
      "o",
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("classifyExistingCheckout", () => {
  it("creates a fresh order when the token has no prior order", () => {
    expect(classifyExistingCheckout(null)).toEqual({ kind: "create" });
  });

  it("reuses a still-PENDING order (retry replays it, no duplicate)", () => {
    expect(classifyExistingCheckout({ id: "o1", status: "PENDING" })).toEqual({
      kind: "reuse",
      orderId: "o1",
    });
  });

  it("treats a settled order as an idempotent success", () => {
    for (const status of ["PAID", "SHIPPED", "FULFILLED"] as const) {
      expect(classifyExistingCheckout({ id: "o1", status })).toEqual({
        kind: "paid",
        orderId: "o1",
      });
    }
  });

  it("treats a terminal order as stale (start over)", () => {
    for (const status of ["CANCELLED", "EXPIRED"] as const) {
      expect(classifyExistingCheckout({ id: "o1", status })).toEqual({
        kind: "stale",
        status,
      });
    }
  });
});
