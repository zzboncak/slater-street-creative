import { describe, it, expect } from "vitest";
import {
  normalizeRequestedItems,
  computeDiscountCents,
  couponValidNow,
  classifyTotal,
  MAX_QTY,
} from "./pricing";

describe("normalizeRequestedItems", () => {
  it("keeps valid string ids with positive integer quantities", () => {
    const m = normalizeRequestedItems({
      items: [
        { productId: "a", quantity: 2 },
        { productId: "b", quantity: 1 },
      ],
    });
    expect([...m]).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });

  it("collapses duplicate ids by summing", () => {
    const m = normalizeRequestedItems({
      items: [
        { productId: "a", quantity: 2 },
        { productId: "a", quantity: 3 },
      ],
    });
    expect(m.get("a")).toBe(5);
  });

  it("drops non-string ids and non-positive / non-integer quantities", () => {
    const m = normalizeRequestedItems({
      items: [
        { productId: 123, quantity: 1 },
        { productId: "a", quantity: 0 },
        { productId: "b", quantity: -3 },
        { productId: "c", quantity: 1.5 },
        { productId: "d", quantity: "2" }, // Number("2") === 2, valid
      ],
    });
    expect([...m]).toEqual([["d", 2]]);
  });

  it("clamps each line to MAX_QTY", () => {
    const m = normalizeRequestedItems({
      items: [{ productId: "a", quantity: 100000 }],
    });
    expect(m.get("a")).toBe(MAX_QTY);
  });

  it("returns an empty map for malformed / missing input", () => {
    expect(normalizeRequestedItems(null).size).toBe(0);
    expect(normalizeRequestedItems({}).size).toBe(0);
    expect(normalizeRequestedItems({ items: "nope" }).size).toBe(0);
  });
});

describe("computeDiscountCents", () => {
  it("applies percentOff with floor rounding", () => {
    // 10% of 1999 = 199.9 -> floor 199
    expect(
      computeDiscountCents(1999, { percentOff: 10, amountOff: null }),
    ).toBe(199);
  });

  it("applies amountOff when no percentOff", () => {
    expect(
      computeDiscountCents(5000, { percentOff: null, amountOff: 1500 }),
    ).toBe(1500);
  });

  it("prefers percentOff when both are set", () => {
    expect(computeDiscountCents(1000, { percentOff: 50, amountOff: 999 })).toBe(
      500,
    );
  });

  it("clamps the discount to the subtotal (never negative total)", () => {
    expect(
      computeDiscountCents(1000, { percentOff: null, amountOff: 5000 }),
    ).toBe(1000);
    expect(
      computeDiscountCents(1000, { percentOff: 150, amountOff: null }),
    ).toBe(1000);
  });

  it("a 100%-off coupon discounts the whole subtotal (total → 0 / free order)", () => {
    expect(
      computeDiscountCents(3000, { percentOff: 100, amountOff: null }),
    ).toBe(3000);
  });

  it("treats percentOff: 0 / amountOff: 0 as valid zero-discount (not falsy-skipped)", () => {
    // 0 is `!= null`, so it must be honored as a real 0% / $0 coupon.
    expect(computeDiscountCents(1000, { percentOff: 0, amountOff: null })).toBe(
      0,
    );
    expect(computeDiscountCents(1000, { percentOff: null, amountOff: 0 })).toBe(
      0,
    );
  });

  it("returns 0 when there is no coupon effect or no subtotal", () => {
    expect(
      computeDiscountCents(1000, { percentOff: null, amountOff: null }),
    ).toBe(0);
    expect(computeDiscountCents(0, { percentOff: 50, amountOff: null })).toBe(
      0,
    );
  });
});

describe("couponValidNow", () => {
  const now = new Date("2026-07-01T12:00:00Z");

  it("rejects inactive coupons", () => {
    expect(
      couponValidNow({ active: false, validFrom: null, validTo: null }, now),
    ).toBe(false);
  });

  it("accepts an active coupon with no date window", () => {
    expect(
      couponValidNow({ active: true, validFrom: null, validTo: null }, now),
    ).toBe(true);
  });

  it("respects validFrom (not yet started)", () => {
    expect(
      couponValidNow(
        { active: true, validFrom: new Date("2026-08-01"), validTo: null },
        now,
      ),
    ).toBe(false);
  });

  it("respects validTo (expired)", () => {
    expect(
      couponValidNow(
        { active: true, validFrom: null, validTo: new Date("2026-06-01") },
        now,
      ),
    ).toBe(false);
  });

  it("accepts within the window", () => {
    expect(
      couponValidNow(
        {
          active: true,
          validFrom: new Date("2026-06-01"),
          validTo: new Date("2026-08-01"),
        },
        now,
      ),
    ).toBe(true);
  });
});

describe("classifyTotal", () => {
  it("classifies a $0 total as free", () => {
    expect(classifyTotal(0)).toBe("free");
    expect(classifyTotal(-10)).toBe("free"); // defensive; totals are floored at 0
  });

  it("classifies 1–49¢ as below_minimum", () => {
    expect(classifyTotal(1)).toBe("below_minimum");
    expect(classifyTotal(49)).toBe("below_minimum");
  });

  it("classifies 50¢ and up as chargeable", () => {
    expect(classifyTotal(50)).toBe("chargeable");
    expect(classifyTotal(3000)).toBe("chargeable");
  });
});
