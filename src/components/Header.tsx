"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/context/CartContext";

export default function Header() {
  const { items } = useCart();
  const [mounted, setMounted] = useState(false);
  const [auth, setAuth] = useState<{ authenticated: boolean } | null>(null);

  useEffect(() => {
    setMounted(true);
    // Fetch auth status
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setAuth({ authenticated: !!data?.authenticated }))
      .catch(() => setAuth({ authenticated: false }));
  }, []);

  const count = items.reduce((n, i) => n + i.quantity, 0);

  async function onLogoutClick(e: React.MouseEvent) {
    e.preventDefault();
    const ok = window.confirm("Are you sure you want to log out?");
    if (!ok) return;
    await fetch("/api/auth/logout", { method: "POST" });
    // Simple client reload to reflect new session state
    window.location.replace("/");
  }
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-background/70 border-b border-black/10 dark:border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">Slater Street Candles</Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/products" className="hover:underline">Products</Link>
          <Link href="/about" className="hover:underline">About</Link>
          <Link href="/contact" className="hover:underline">Contact</Link>
          {auth?.authenticated ? (
            <a href="#logout" onClick={onLogoutClick} className="hover:underline">Logout</a>
          ) : (
            <Link href="/login" className="hover:underline">Login</Link>
          )}
          <Link href="/cart" className="relative">
            <span className="hover:underline">Cart</span>
            {mounted && count > 0 && (
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
