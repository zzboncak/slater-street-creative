// Pure inventory math, kept framework/DB-free so it's unit-testable.

/**
 * Apply a decrement to a stock level, floored at 0. `oversold` is true when the
 * requested quantity exceeded what was in stock (the caller should log it); the
 * returned `next` is still clamped to 0 so stock never goes negative.
 */
export function applyInventoryDelta(
  current: number,
  qty: number,
): { next: number; oversold: boolean } {
  const raw = current - qty;
  return { next: Math.max(0, raw), oversold: raw < 0 };
}
