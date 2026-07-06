import type { CartItem } from "@/types";

// Pure cart state + reducer, split out from CartContext so it can be unit-tested
// without pulling in React/JSX. The cart holds only { productId, quantity };
// pricing is re-fetched from the server (POST /api/cart).

export type CartState = { items: CartItem[] };

export type CartAction =
  | { type: "ADD"; productId: string; quantity?: number }
  | { type: "REMOVE"; productId: string }
  | { type: "CLEAR" }
  | { type: "SET_QTY"; productId: string; quantity: number }
  | { type: "PRUNE"; keepIds: string[] };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const qty = action.quantity ?? 1;
      const idx = state.items.findIndex(
        (i) => i.productId === action.productId,
      );
      if (idx >= 0) {
        const items = [...state.items];
        items[idx] = { ...items[idx], quantity: items[idx].quantity + qty };
        return { items };
      }
      return {
        items: [...state.items, { productId: action.productId, quantity: qty }],
      };
    }
    case "REMOVE":
      return {
        items: state.items.filter((i) => i.productId !== action.productId),
      };
    case "CLEAR":
      return { items: [] };
    case "SET_QTY":
      return {
        items: state.items.map((i) =>
          i.productId === action.productId
            ? { ...i, quantity: Math.max(1, action.quantity) }
            : i,
        ),
      };
    case "PRUNE": {
      const keep = new Set(action.keepIds);
      const items = state.items.filter((i) => keep.has(i.productId));
      // Avoid a needless state change (and re-render/refetch loop) when nothing
      // was actually pruned.
      return items.length === state.items.length ? state : { items };
    }
    default:
      return state;
  }
}
