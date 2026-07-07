"use client";

import { useEffect } from "react";
import { useCart } from "@/context/CartContext";

export default function ClearCartOnMount() {
  const { clear } = useCart();

  useEffect(() => {
    // Clear the cart once when redirected here after placing an order
    // (/thank-you?order=<id>). Defense-in-depth: checkout also clears before
    // redirecting, so this is a backstop for direct/refreshed landings.
    const params = new URLSearchParams(window.location.search);
    if (params.get("order")) {
      clear();
      // Clean up the URL so refreshes don't re-clear
      const url = new URL(window.location.href);
      url.searchParams.delete("order");
      window.history.replaceState({}, "", url.toString());
    }
  }, [clear]);

  return null;
}
