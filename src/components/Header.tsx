"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function Header() {
  const { items } = useCart();
  const count = items.reduce((n, i) => n + i.quantity, 0);
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-background/70 border-b border-black/10 dark:border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">Slater Street Candles</Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/products" className="hover:underline">Products</Link>
          <Link href="/about" className="hover:underline">About</Link>
          <Link href="/cart" className="relative">
            <span className="hover:underline">Cart</span>
            {count > 0 && (
              <span className="absolute -top-2 -right-3 text-xs px-1.5 py-0.5 rounded-full bg-black text-white dark:bg-white dark:text-black">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
