import { describe, it, expect } from "vitest";
import type { Role } from "@prisma/client";
import { roleHasCapability, hasAnyCapability, type Capability } from "./authz";

const ALL_CAPS: Capability[] = [
  "manageProducts",
  "manageCoupons",
  "manageInventory",
  "manageImages",
  "viewOrders",
  "fulfillOrders",
];

// The full intended matrix, stated once. Using Record<Role, …> makes this
// exhaustive: adding a Role fails to compile until its capabilities are declared
// here, so the enum and the authorization policy can't silently drift apart.
const EXPECTED: Record<Role, Capability[]> = {
  ADMIN: [...ALL_CAPS], // everything
  FULFILLMENT: ["viewOrders", "fulfillOrders"], // the order queue only
  CUSTOMER: [], // nothing admin-facing
};

const ROLES = Object.keys(EXPECTED) as Role[];

describe("roleHasCapability — full role×capability matrix", () => {
  for (const role of ROLES) {
    for (const cap of ALL_CAPS) {
      const expected = EXPECTED[role].includes(cap);
      it(`${role} ${expected ? "HAS" : "lacks"} ${cap}`, () => {
        expect(roleHasCapability(role, cap)).toBe(expected);
      });
    }
  }
});

describe("hasAnyCapability — admin-area membership", () => {
  it("ADMIN and FULFILLMENT belong in the admin area", () => {
    expect(hasAnyCapability("ADMIN")).toBe(true);
    expect(hasAnyCapability("FULFILLMENT")).toBe(true);
  });

  it("CUSTOMER holds no capabilities → kept out of the admin area", () => {
    expect(hasAnyCapability("CUSTOMER")).toBe(false);
  });
});

describe("capability boundaries (the enforcement that matters)", () => {
  it("FULFILLMENT is confined to orders — no product/coupon/inventory/image management", () => {
    expect(roleHasCapability("FULFILLMENT", "manageProducts")).toBe(false);
    expect(roleHasCapability("FULFILLMENT", "manageCoupons")).toBe(false);
    expect(roleHasCapability("FULFILLMENT", "manageInventory")).toBe(false);
    expect(roleHasCapability("FULFILLMENT", "manageImages")).toBe(false);
    expect(roleHasCapability("FULFILLMENT", "viewOrders")).toBe(true);
    expect(roleHasCapability("FULFILLMENT", "fulfillOrders")).toBe(true);
  });

  it("CUSTOMER can do nothing admin-facing", () => {
    for (const cap of ALL_CAPS) {
      expect(roleHasCapability("CUSTOMER", cap)).toBe(false);
    }
  });
});
