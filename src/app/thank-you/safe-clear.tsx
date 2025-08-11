"use client";

import { useEffect } from "react";
import { useCart } from "@/context/CartContext";

export default function ClearCartOnMount() {
  const { clear } = useCart();

  useEffect(() => {
    // Only clear if redirected from our checkout stub
    const params = new URLSearchParams(window.location.search);
    if (params.get("completed") === "1") {
      clear();
      // Clean up the URL so refreshes don't re-clear
      const url = new URL(window.location.href);
      url.searchParams.delete("completed");
      window.history.replaceState({}, "", url.toString());
    }
  }, [clear]);

  return null;
}
