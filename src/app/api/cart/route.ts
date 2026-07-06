import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PricedCart } from "@/types";

export const dynamic = "force-dynamic";

// Upper bound per line so a crafted request can't produce absurd totals.
const MAX_QTY = 999;

/**
 * Re-price a cart from the database. The client sends only { productId, quantity }
 * — never prices — and the server returns authoritative per-line and subtotal
 * amounts computed from current DB prices. Unknown/inactive products are dropped.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  // Normalize + validate: keep string ids with a positive integer quantity,
  // collapsing duplicate ids and clamping the total per product.
  const wanted = new Map<string, number>();
  for (const it of rawItems) {
    if (!it || typeof it.productId !== "string") continue;
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty < 1) continue;
    const next = Math.min((wanted.get(it.productId) ?? 0) + qty, MAX_QTY);
    wanted.set(it.productId, next);
  }

  const empty: PricedCart = { lines: [], subtotalCents: 0 };
  if (wanted.size === 0) return NextResponse.json(empty);

  const products = await prisma.product.findMany({
    where: { id: { in: [...wanted.keys()] }, active: true },
    select: { id: true, name: true, image: true, priceCents: true },
  });

  const lines = products
    .map((p) => {
      const quantity = wanted.get(p.id) ?? 0;
      return {
        productId: p.id,
        name: p.name,
        image: p.image ?? "",
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
