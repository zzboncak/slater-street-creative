"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { CartItem, Product } from "@/types";

// Simple cart reducer

type State = { items: CartItem[] };

type Action =
  | { type: "ADD"; product: Product; quantity?: number }
  | { type: "REMOVE"; productId: string }
  | { type: "CLEAR" }
  | { type: "SET_QTY"; productId: string; quantity: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD": {
      const qty = action.quantity ?? 1;
      const idx = state.items.findIndex(
        (i) => i.product.id === action.product.id,
      );
      if (idx >= 0) {
        const items = [...state.items];
        items[idx] = { ...items[idx], quantity: items[idx].quantity + qty };
        return { items };
      }
      return {
        items: [...state.items, { product: action.product, quantity: qty }],
      };
    }
    case "REMOVE":
      return {
        items: state.items.filter((i) => i.product.id !== action.productId),
      };
    case "CLEAR":
      return { items: [] };
    case "SET_QTY":
      return {
        items: state.items.map((i) =>
          i.product.id === action.productId
            ? { ...i, quantity: Math.max(1, action.quantity) }
            : i,
        ),
      };
    default:
      return state;
  }
}

function subtotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
}

export type CartContextType = {
  items: CartItem[];
  add: (product: Product, quantity?: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setQty: (productId: string, quantity: number) => void;
  subtotal: number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] }, (init) => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("cart");
        if (raw) return JSON.parse(raw) as State;
      } catch {}
    }
    return init;
  });

  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(state));
    } catch {}
  }, [state]);

  const value = useMemo<CartContextType>(
    () => ({
      items: state.items,
      add: (product, quantity) => dispatch({ type: "ADD", product, quantity }),
      remove: (productId) => dispatch({ type: "REMOVE", productId }),
      clear: () => dispatch({ type: "CLEAR" }),
      setQty: (productId, quantity) =>
        dispatch({ type: "SET_QTY", productId, quantity }),
      subtotal: subtotal(state.items),
    }),
    [state.items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
