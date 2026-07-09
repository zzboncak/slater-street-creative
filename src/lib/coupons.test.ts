import { describe, it, expect, vi } from "vitest";
import type { Coupon } from "@prisma/client";
import {
  resolveCoupon,
  claimCouponRedemption,
  releaseCouponRedemption,
} from "./coupons";

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: "c1",
    code: "SAVE10",
    description: null,
    percentOff: 10,
    amountOff: null,
    active: true,
    validFrom: null,
    validTo: null,
    createdAt: new Date("2026-01-01"),
    maxRedemptions: null,
    perUserLimit: null,
    usedCount: 0,
    allowFreeOrders: false,
    ...overrides,
  };
}

// A DB double exposing just the `.coupon.findUnique` the resolver uses, cast to
// the resolver's DB param type (mocks don't implement the full Prisma delegate).
function makeDb(row: Coupon | null) {
  const findUnique = vi.fn().mockResolvedValue(row);
  const db = { coupon: { findUnique } } as unknown as Parameters<
    typeof resolveCoupon
  >[0];
  return { db, findUnique };
}

describe("resolveCoupon", () => {
  it("returns not_found for an empty/whitespace code without touching the DB", async () => {
    const { db, findUnique } = makeDb(null);
    expect(await resolveCoupon(db, "   ", 1000)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns not_found when the code doesn't exist", async () => {
    const { db } = makeDb(null);
    expect(await resolveCoupon(db, "NOPE", 1000)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("normalizes the code (trim + uppercase) before lookup", async () => {
    const { db, findUnique } = makeDb(makeCoupon());
    await resolveCoupon(db, "  save10 ", 1000);
    expect(findUnique).toHaveBeenCalledWith({ where: { code: "SAVE10" } });
  });

  it("returns not_valid for an inactive coupon", async () => {
    const { db } = makeDb(makeCoupon({ active: false }));
    expect(await resolveCoupon(db, "SAVE10", 1000)).toEqual({
      ok: false,
      reason: "not_valid",
    });
  });

  it("returns not_valid for an expired coupon", async () => {
    const { db } = makeDb(makeCoupon({ validTo: new Date("2020-01-01") }));
    expect(await resolveCoupon(db, "SAVE10", 1000)).toEqual({
      ok: false,
      reason: "not_valid",
    });
  });

  it("resolves a valid percentOff coupon to a floored discount", async () => {
    const coupon = makeCoupon({ percentOff: 10, amountOff: null });
    const { db } = makeDb(coupon);
    const result = await resolveCoupon(db, "SAVE10", 1999);
    expect(result).toEqual({ ok: true, discountCents: 199, coupon }); // floor(199.9)
  });

  it("resolves a valid amountOff coupon", async () => {
    const coupon = makeCoupon({ percentOff: null, amountOff: 500 });
    const { db } = makeDb(coupon);
    const result = await resolveCoupon(db, "FIVE", 1000);
    expect(result).toEqual({ ok: true, discountCents: 500, coupon });
  });

  it("returns exhausted when the global redemption cap is reached (SSC-30)", async () => {
    const { db } = makeDb(makeCoupon({ maxRedemptions: 5, usedCount: 5 }));
    expect(await resolveCoupon(db, "SAVE10", 1000)).toEqual({
      ok: false,
      reason: "exhausted",
    });
  });

  it("still resolves when usedCount is below the cap", async () => {
    const coupon = makeCoupon({ maxRedemptions: 5, usedCount: 4 });
    const { db } = makeDb(coupon);
    expect(await resolveCoupon(db, "SAVE10", 1000)).toEqual({
      ok: true,
      discountCents: 100,
      coupon,
    });
  });
});

// A DB double exposing coupon.updateMany; `count` is the rows it reports matched.
function makeCountDb(count: number) {
  const updateMany = vi.fn().mockResolvedValue({ count });
  const db = { coupon: { updateMany } } as unknown as Parameters<
    typeof claimCouponRedemption
  >[0];
  return { db, updateMany };
}

describe("claimCouponRedemption", () => {
  it("reserves under a cap via compare-and-set and returns true", async () => {
    const { db, updateMany } = makeCountDb(1);
    expect(await claimCouponRedemption(db, "c1", 100)).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "c1", usedCount: { lt: 100 } },
      data: { usedCount: { increment: 1 } },
    });
  });

  it("returns false when the cap is already reached (0 rows matched)", async () => {
    const { db } = makeCountDb(0);
    expect(await claimCouponRedemption(db, "c1", 5)).toBe(false);
  });

  it("omits the cap guard for an uncapped coupon but still increments", async () => {
    const { db, updateMany } = makeCountDb(1);
    expect(await claimCouponRedemption(db, "c1", null)).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { usedCount: { increment: 1 } },
    });
  });
});

describe("releaseCouponRedemption", () => {
  it("decrements with a floor guard so usedCount can't go negative", async () => {
    const { db, updateMany } = makeCountDb(1);
    await releaseCouponRedemption(db, "SAVE5");
    expect(updateMany).toHaveBeenCalledWith({
      where: { code: "SAVE5", usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });
});
