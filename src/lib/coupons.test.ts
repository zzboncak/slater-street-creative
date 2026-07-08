import { describe, it, expect, vi } from "vitest";
import type { Coupon } from "@prisma/client";
import { resolveCoupon } from "./coupons";

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
});
