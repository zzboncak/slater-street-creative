import { NextResponse } from "next/server";
import { getActiveProductsByIds } from "@/lib/products";
import { normalizeRequestedItems } from "@/lib/pricing";
import type { PricedCart } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Re-price a cart from the database. The client sends only { productId, quantity }
 * — never prices — and the server returns authoritative per-line and subtotal
 * amounts computed from current DB prices. Unknown/inactive products are dropped.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const wanted = normalizeRequestedItems(body);

  const empty: PricedCart = { lines: [], subtotalCents: 0 };
  if (wanted.size === 0) return NextResponse.json(empty);

  const products = await getActiveProductsByIds([...wanted.keys()]);

  const lines = products
    .map((p) => {
      const quantity = wanted.get(p.id) ?? 0;
      return {
        productId: p.id,
        name: p.name,
        image: p.image, // already normalized to "" by the products helper
        priceCents: p.priceCents,
        quantity,
        lineTotalCents: p.priceCents * quantity,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const result: PricedCart = { lines, subtotalCents };
  return NextResponse.json(result);
}
