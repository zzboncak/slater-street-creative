import { describe, it, expect } from "vitest";
import { applyInventoryDelta } from "./inventory";

describe("applyInventoryDelta", () => {
  it("decrements normally when there is enough stock", () => {
    expect(applyInventoryDelta(10, 3)).toEqual({ next: 7, oversold: false });
  });

  it("reaches exactly zero without flagging oversell", () => {
    expect(applyInventoryDelta(5, 5)).toEqual({ next: 0, oversold: false });
  });

  it("floors at 0 and flags oversell when qty exceeds stock", () => {
    expect(applyInventoryDelta(2, 5)).toEqual({ next: 0, oversold: true });
  });

  it("treats zero stock as an oversell for any positive qty", () => {
    expect(applyInventoryDelta(0, 1)).toEqual({ next: 0, oversold: true });
  });

  it("is a no-op for a zero quantity", () => {
    expect(applyInventoryDelta(4, 0)).toEqual({ next: 4, oversold: false });
  });
});
