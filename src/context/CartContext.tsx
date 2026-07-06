"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { CartItem } from "@/types";

// Cart holds only { productId, quantity }. Pricing/details come from the server
// (POST /api/cart) — the client never stores or computes authoritative money.

type State = { items: CartItem[] };

type Action =
  | { type: "ADD"; productId: string; quantity?: number }
  | { type: "REMOVE"; productId: string }
  | { type: "CLEAR" }
  | { type: "SET_QTY"; productId: string; quantity: number }
  | { type: "PRUNE"; keepIds: string[] };

function reducer(state: State, action: Action): State {
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

export type CartContextType = {
  items: CartItem[];
  count: number;
  add: (productId: string, quantity?: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setQty: (productId: string, quantity: number) => void;
  prune: (keepIds: string[]) => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] }, (init) => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("cart");
        if (raw) {
          const parsed = JSON.parse(raw) as State;
          if (Array.isArray(parsed?.items)) {
            // Normalize on load: keep only { productId: string, quantity: int>=1 }
            // and collapse duplicate ids (summing) so the rest of the app can
            // rely on unique ids. Anything else (incl. the old shape) is dropped.
            const merged = new Map<string, number>();
            for (const i of parsed.items) {
              if (typeof i?.productId !== "string") continue;
              if (!Number.isInteger(i?.quantity) || i.quantity < 1) continue;
              merged.set(
                i.productId,
                (merged.get(i.productId) ?? 0) + i.quantity,
              );
            }
            return {
              items: [...merged].map(([productId, quantity]) => ({
                productId,
                quantity,
              })),
            };
          }
        }
      } catch {}
    }
    return init;
  });

  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(state));
    } catch {}
  }, [state]);

  // Stable callbacks (dispatch is stable) so effects that depend on them don't
  // re-run on every render.
  const add = useCallback(
    (productId: string, quantity?: number) =>
      dispatch({ type: "ADD", productId, quantity }),
    [],
  );
  const remove = useCallback(
    (productId: string) => dispatch({ type: "REMOVE", productId }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);
  const setQty = useCallback(
    (productId: string, quantity: number) =>
      dispatch({ type: "SET_QTY", productId, quantity }),
    [],
  );
  const prune = useCallback(
    (keepIds: string[]) => dispatch({ type: "PRUNE", keepIds }),
    [],
  );

  const count = useMemo(
    () => state.items.reduce((n, i) => n + i.quantity, 0),
    [state.items],
  );

  const value = useMemo<CartContextType>(
    () => ({
      items: state.items,
      count,
      add,
      remove,
      clear,
      setQty,
      prune,
    }),
    [state.items, count, add, remove, clear, setQty, prune],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
