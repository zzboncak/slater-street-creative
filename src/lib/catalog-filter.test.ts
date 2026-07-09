import { describe, it, expect } from "vitest";
import { distinctScents, filterProducts } from "./catalog-filter";
import type { Product } from "@/types";

function p(overrides: Partial<Product>): Product {
  return {
    id: "p1",
    name: "Candle",
    priceCents: 1500,
    scentProfile: [],
    description: "",
    image: "",
    ...overrides,
  };
}

const catalog = [
  p({
    id: "garden",
    name: "The Garden",
    scentProfile: ["Lavender", "Sage"],
    description: "A calm garden blend",
  }),
  p({
    id: "cafe",
    name: "The Cafe",
    scentProfile: ["Espresso", "Vanilla"],
    description: "Warm coffeehouse",
  }),
  p({
    id: "dusk",
    name: "Dusk",
    scentProfile: ["Lavender", "Amber"],
    description: "Evening woods",
  }),
];

const ids = (list: Product[]) => list.map((x) => x.id).sort();

describe("distinctScents", () => {
  it("returns sorted unique scents across the catalog", () => {
    expect(distinctScents(catalog)).toEqual([
      "Amber",
      "Espresso",
      "Lavender",
      "Sage",
      "Vanilla",
    ]);
  });

  it("is empty for no products", () => {
    expect(distinctScents([])).toEqual([]);
  });
});

describe("filterProducts", () => {
  it("returns all when the query is empty and no scent filter", () => {
    expect(filterProducts(catalog, {})).toHaveLength(3);
  });

  it("matches a scent note case-insensitively (lavender → Lavender)", () => {
    expect(ids(filterProducts(catalog, { q: "lavender" }))).toEqual([
      "dusk",
      "garden",
    ]);
  });

  it("matches by name", () => {
    expect(ids(filterProducts(catalog, { q: "cafe" }))).toEqual(["cafe"]);
  });

  it("matches by description", () => {
    expect(ids(filterProducts(catalog, { q: "coffeehouse" }))).toEqual([
      "cafe",
    ]);
  });

  it("filters by an exact scent and ANDs with the query", () => {
    expect(ids(filterProducts(catalog, { scent: "Lavender" }))).toEqual([
      "dusk",
      "garden",
    ]);
    expect(
      ids(filterProducts(catalog, { scent: "Lavender", q: "garden" })),
    ).toEqual(["garden"]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterProducts(catalog, { q: "zzz" })).toEqual([]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(ids(filterProducts(catalog, { q: "  amber " }))).toEqual(["dusk"]);
  });
});
