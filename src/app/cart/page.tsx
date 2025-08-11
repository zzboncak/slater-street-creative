"use client";

import { useCart } from "@/context/CartContext";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/components/ProductCard";
import { cfImageUrl } from "@/lib/cloudflare-images";

export default function CartPage() {
  const { items, remove, setQty, clear, subtotal } = useCart();
  const hasItems = items.length > 0;

  async function handleCheckout() {
    // POST to our API route to create Stripe Checkout Session (stub for now)
    const res = await fetch("/api/checkout", { method: "POST" });
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold mb-6">Your cart</h1>
      {!hasItems && (
        <div className="rounded-md border border-black/10 dark:border-white/15 p-6">
          <p>Your cart is empty.</p>
          <Link href="/products" className="inline-block mt-4 underline">Browse products</Link>
        </div>
      )}

      {hasItems && (
        <div className="grid gap-8 md:grid-cols-[1fr_320px]">
          <ul className="space-y-4">
            {items.map(({ product, quantity }) => (
              <li key={product.id} className="flex items-center gap-4 border rounded-md p-3">
                <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded">
                  {(() => {
                    const isAbs = /^https?:\/\//i.test(product.image);
                    const src = isAbs ? product.image : cfImageUrl(product.image, "public");
                    return <Image src={src} alt={product.name} fill className="object-cover" />;
                  })()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{product.name}</h3>
                    <button className="text-sm underline" onClick={() => remove(product.id)}>Remove</button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">{product.description}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <label className="text-sm" htmlFor={`qty-${product.id}`}>Qty</label>
                    <input
                      id={`qty-${product.id}`}
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQty(product.id, Number(e.target.value))}
                      className="w-16 rounded border px-2 py-1 bg-transparent"
                    />
                    <span className="ml-auto font-medium">{formatPrice(product.price * quantity)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-md border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300">Taxes and shipping calculated at checkout.</p>
            <button onClick={handleCheckout} className="w-full rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium">
              Checkout
            </button>
            <button onClick={clear} className="w-full text-sm underline">Clear cart</button>
          </aside>
        </div>
      )}
    </div>
  );
}
