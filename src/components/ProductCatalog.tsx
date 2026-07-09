"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types";
import { filterProducts } from "@/lib/catalog-filter";

// Client-side catalog with instant, as-you-type search (name / description /
// scent) and a scent-note filter. The catalog is loaded once from the DB by the
// server page and passed in; this only filters what's shown, so no per-keystroke
// network round-trip (SSC-19). Fine for the current small catalog; a growing one
// would move to a server search endpoint.
export default function ProductCatalog({
  products,
  scents,
}: {
  products: Product[];
  scents: string[];
}) {
  const [q, setQ] = useState("");
  const [scent, setScent] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterProducts(products, { q, scent }),
    [products, q, scent],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or scent (e.g. Lavender)…"
          aria-label="Search products"
          className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
        {scents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScent(null)}
              aria-pressed={scent === null}
              className={pillClass(scent === null)}
            >
              All
            </button>
            {scents.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScent((cur) => (cur === s ? null : s))}
                aria-pressed={scent === s}
                className={pillClass(scent === s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          No candles match{q ? ` “${q.trim()}”` : ""}
          {scent ? ` in ${scent}` : ""}.{" "}
          <button
            type="button"
            onClick={() => {
              setQ("");
              setScent(null);
            }}
            className="underline"
          >
            Clear filters
          </button>
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function pillClass(active: boolean): string {
  return [
    "rounded-full border px-3 py-1 text-sm transition-colors",
    active
      ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
      : "border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10",
  ].join(" ");
}
