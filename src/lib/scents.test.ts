import { describe, it, expect } from "vitest";
import { scentSlug } from "./scents";

describe("scentSlug", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(scentSlug("Blue Spruce")).toBe("blue-spruce");
    expect(scentSlug("fresh basil")).toBe("fresh-basil");
  });

  it("collapses runs of non-alphanumerics and trims edge hyphens", () => {
    expect(scentSlug("  Blue   Spruce  ")).toBe("blue-spruce");
    expect(scentSlug("Lemon & Lime")).toBe("lemon-lime");
    expect(scentSlug("--odd--")).toBe("odd");
  });

  it("folds casing/whitespace variants to the same slug (the dedup guarantee)", () => {
    const variants = ["Lavender", "lavender", " LAVENDER ", "laVender"];
    const slugs = new Set(variants.map(scentSlug));
    expect([...slugs]).toEqual(["lavender"]);
  });

  it("keeps digits", () => {
    expect(scentSlug("No. 5")).toBe("no-5");
  });
});
