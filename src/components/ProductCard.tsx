"use client";

import Image from "next/image";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/types";

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  return (
    <div className="group rounded-lg border border-black/10 dark:border-white/15 overflow-hidden bg-white/90 dark:bg-black/30">
      <div className="relative aspect-[4/3]">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 300px, (min-width: 640px) 33vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-medium">{product.name}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="font-semibold">{formatPrice(product.price)}</span>
          <button
            onClick={() => add(product, 1)}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm hover:opacity-90"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
