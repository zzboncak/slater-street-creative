"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/components/ProductCard";
import {
  productImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/cloudflare-images";
import { ecommerceEnabled, checkoutEnabled } from "@/lib/flags";
import type { PricedCart } from "@/types";

export default function CartPage() {
  // The cart is part of the gated commerce surface.
  if (!ecommerceEnabled()) notFound();
  const { items, remove, setQty, clear, prune } = useCart();
  const [priced, setPriced] = useState<PricedCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState(""); // committed code sent to the server

  // Re-price from the server whenever the cart changes. Money is never computed
  // client-side; we only send { productId, quantity } and render what comes back.
  useEffect(() => {
    if (items.length === 0) {
      setPriced({
        lines: [],
        subtotalCents: 0,
        discountCents: 0,
        totalCents: 0,
      });
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, couponCode: coupon }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("pricing failed");
        return r.json() as Promise<PricedCart>;
      })
      .then((data) => {
        if (cancelled) return;
        setPriced(data);
        setLoading(false);
        // Drop ids the server didn't recognize (e.g. product deleted/deactivated
        // after it was added). Only on a successful response, never on error.
        if (data.lines.length !== items.length) {
          prune(data.lines.map((l) => l.productId));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [items, coupon, prune]);

  // Quantity inputs are driven by client cart state so they feel instant; line
  // totals and subtotal come from the server.
  const qtyById = useMemo(
    () => new Map(items.map((i) => [i.productId, i.quantity])),
    [items],
  );

  const hasItems = items.length > 0;
  const lines = priced?.lines ?? [];

  async function handleCheckout() {
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, couponCode: coupon }),
      });
      // Checkout requires a logged-in session; send guests to log in and back.
      if (res.status === 401) {
        window.location.href = "/login?next=/cart";
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setCheckoutError(
          data?.error ?? "Sorry — checkout failed. Please try again.",
        );
        return;
      }
      // Hand off to Stripe-hosted Checkout. Don't clear the cart here — a
      // cancelled payment returns to /cart with items intact; the cart is
      // cleared on the /thank-you?order= landing after a successful payment.
      window.location.href = data.url;
    } catch {
      setCheckoutError("Sorry — checkout failed. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold mb-6">Your cart</h1>

      {!hasItems && (
        <div className="rounded-md border border-black/10 dark:border-white/15 p-6">
          <p>Your cart is empty.</p>
          <Link href="/products" className="inline-block mt-4 underline">
            Browse products
          </Link>
        </div>
      )}

      {hasItems && error && (
        <div className="rounded-md border border-red-500/40 p-6">
          <p>Sorry — we couldn’t load your cart just now. Please try again.</p>
        </div>
      )}

      {hasItems && !error && (
        <div className="grid gap-8 md:grid-cols-[1fr_320px]">
          <ul className="space-y-4">
            {lines.map((line) => {
              const src =
                productImageUrl(line.image) ?? PRODUCT_IMAGE_PLACEHOLDER;
              const qty = qtyById.get(line.productId) ?? line.quantity;
              return (
                <li
                  key={line.productId}
                  className="flex items-center gap-4 border rounded-md p-3"
                >
                  <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded">
                    <Image
                      src={src}
                      alt={line.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{line.name}</h3>
                      <button
                        className="text-sm underline"
                        onClick={() => remove(line.productId)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <label
                        className="text-sm"
                        htmlFor={`qty-${line.productId}`}
                      >
                        Qty
                      </label>
                      <input
                        id={`qty-${line.productId}`}
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) =>
                          setQty(line.productId, Number(e.target.value))
                        }
                        className="w-16 rounded border px-2 py-1 bg-transparent"
                      />
                      <span className="ml-auto font-medium">
                        {formatPrice(line.lineTotalCents)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="h-fit rounded-md border p-4 space-y-4">
            {/* Coupon */}
            <div className="space-y-1">
              <label htmlFor="coupon" className="text-sm">
                Coupon code
              </label>
              <div className="flex gap-2">
                <input
                  id="coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Enter code"
                  className="flex-1 rounded border px-2 py-1 bg-transparent"
                />
                <button
                  onClick={() => setCoupon(couponInput.trim())}
                  className="rounded border px-3 py-1 text-sm"
                >
                  Apply
                </button>
              </div>
              {priced?.coupon?.applied && (
                <p className="text-xs text-green-700 dark:text-green-400">
                  Coupon {priced.coupon.code} applied.{" "}
                  <button
                    onClick={() => {
                      setCoupon("");
                      setCouponInput("");
                    }}
                    className="underline"
                  >
                    Remove
                  </button>
                </p>
              )}
              {priced?.coupon && !priced.coupon.applied && (
                <p className="text-xs text-red-600" role="alert">
                  {priced.coupon.message}
                </p>
              )}
            </div>

            {/* Totals — all server-computed */}
            <div className="space-y-1 border-t pt-3">
              <div className="flex items-center justify-between text-sm">
                <span>Subtotal</span>
                <span>
                  {loading && !priced
                    ? "…"
                    : formatPrice(priced?.subtotalCents ?? 0)}
                </span>
              </div>
              {(priced?.discountCents ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm text-green-700 dark:text-green-400">
                  <span>Discount</span>
                  <span>−{formatPrice(priced?.discountCents ?? 0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>
                  {loading && !priced
                    ? "…"
                    : formatPrice(priced?.totalCents ?? 0)}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Taxes and shipping calculated at checkout.
            </p>
            {checkoutError && (
              <p className="text-sm text-red-600" role="alert">
                {checkoutError}
              </p>
            )}
            {checkoutEnabled() ? (
              <button
                onClick={handleCheckout}
                disabled={checkingOut || loading}
                className="w-full rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium disabled:opacity-50"
              >
                {checkingOut ? "Placing order…" : "Checkout"}
              </button>
            ) : (
              <p className="rounded-md border border-black/10 dark:border-white/15 px-4 py-2 text-center text-sm text-gray-600 dark:text-gray-300">
                Checkout is coming soon.
              </p>
            )}
            <button onClick={clear} className="w-full text-sm underline">
              Clear cart
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
