import { describe, it, expect, afterEach, vi } from "vitest";
import { ecommerceEnabled, checkoutEnabled } from "./flags";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("feature flags (fail-closed)", () => {
  it("is off when the var is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_ECOMMERCE", undefined as unknown as string);
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CHECKOUT", undefined as unknown as string);
    expect(ecommerceEnabled()).toBe(false);
    expect(checkoutEnabled()).toBe(false);
  });

  it('is on only for the exact string "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_ECOMMERCE", "true");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CHECKOUT", "true");
    expect(ecommerceEnabled()).toBe(true);
    expect(checkoutEnabled()).toBe(true);
  });

  it("stays off for truthy-but-not-true values", () => {
    for (const v of ["1", "TRUE", "yes", "on", " true "]) {
      vi.stubEnv("NEXT_PUBLIC_ENABLE_ECOMMERCE", v);
      vi.stubEnv("NEXT_PUBLIC_ENABLE_CHECKOUT", v);
      expect(ecommerceEnabled()).toBe(false);
      expect(checkoutEnabled()).toBe(false);
    }
  });
});
