"use client";

import { useEffect } from "react";
import { useCart } from "@/context/CartContext";

// Rendered by the thank-you page ONLY when a real order owned by the current
// user has loaded — so clearing the cart on mount is safe (it's gated on a
// confirmed order server-side, not on the presence of a URL param).
export default function ClearCartOnMount() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
