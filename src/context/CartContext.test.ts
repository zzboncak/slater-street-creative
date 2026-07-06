import { describe, it, expect } from "vitest";
import { cartReducer, type CartState } from "@/context/cart-reducer";

const empty: CartState = { items: [] };

describe("cartReducer", () => {
  it("ADD inserts a new item", () => {
    const s = cartReducer(empty, { type: "ADD", productId: "a", quantity: 2 });
    expect(s.items).toEqual([{ productId: "a", quantity: 2 }]);
  });

  it("ADD defaults quantity to 1", () => {
    const s = cartReducer(empty, { type: "ADD", productId: "a" });
    expect(s.items).toEqual([{ productId: "a", quantity: 1 }]);
  });

  it("ADD increments the quantity of an existing item", () => {
    const s1 = cartReducer(empty, { type: "ADD", productId: "a", quantity: 1 });
    const s2 = cartReducer(s1, { type: "ADD", productId: "a", quantity: 2 });
    expect(s2.items).toEqual([{ productId: "a", quantity: 3 }]);
  });

  it("REMOVE deletes the matching item", () => {
    const s1 = cartReducer(empty, { type: "ADD", productId: "a" });
    const s2 = cartReducer(s1, { type: "REMOVE", productId: "a" });
    expect(s2.items).toEqual([]);
  });

  it("SET_QTY sets the quantity and clamps to at least 1", () => {
    const s1 = cartReducer(empty, { type: "ADD", productId: "a", quantity: 5 });
    expect(
      cartReducer(s1, { type: "SET_QTY", productId: "a", quantity: 3 }).items,
    ).toEqual([{ productId: "a", quantity: 3 }]);
    expect(
      cartReducer(s1, { type: "SET_QTY", productId: "a", quantity: 0 }).items,
    ).toEqual([{ productId: "a", quantity: 1 }]);
    expect(
      cartReducer(s1, { type: "SET_QTY", productId: "a", quantity: -4 }).items,
    ).toEqual([{ productId: "a", quantity: 1 }]);
  });

  it("CLEAR empties the cart", () => {
    const s1 = cartReducer(empty, { type: "ADD", productId: "a" });
    expect(cartReducer(s1, { type: "CLEAR" }).items).toEqual([]);
  });

  it("PRUNE keeps only the listed ids", () => {
    let s = cartReducer(empty, { type: "ADD", productId: "a" });
    s = cartReducer(s, { type: "ADD", productId: "b" });
    expect(cartReducer(s, { type: "PRUNE", keepIds: ["a"] }).items).toEqual([
      { productId: "a", quantity: 1 },
    ]);
  });

  it("PRUNE returns the same state object when nothing is removed", () => {
    const s = cartReducer(empty, { type: "ADD", productId: "a" });
    // Identity preserved so the cart page's effect doesn't needlessly refetch.
    expect(cartReducer(s, { type: "PRUNE", keepIds: ["a", "x"] })).toBe(s);
  });
});
