import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProductsByIds } from "@/lib/products";
import {
  normalizeRequestedItems,
  computeDiscountCents,
  couponValidNow,
} from "@/lib/pricing";
import { ecommerceEnabled } from "@/lib/flags";
import type { CouponStatus, PricedCart } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Re-price a cart from the database. The client sends only { productId, quantity }
 * (never prices) plus an optional couponCode, and the server returns
 * authoritative per-line, subtotal, discount, and total amounts computed from
 * current DB prices. Unknown/inactive products are dropped. Coupon feedback is
 * SOFT here — an invalid/expired code prices the cart at full price with a
 * message (the hard 400 rejection happens at /api/checkout).
 */
export async function POST(req: Request) {
  // Part of the gated commerce surface — hidden when e-commerce is off.
  if (!ecommerceEnabled()) {
    return NextResponse.json(
      { error: "Not found", code: "ecommerce_disabled" },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const wanted = normalizeRequestedItems(body);
  const couponCode =
    typeof body?.couponCode === "string"
      ? body.couponCode.trim().toUpperCase()
      : "";

  const empty: PricedCart = {
    lines: [],
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
  };
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

  let discountCents = 0;
  let coupon: CouponStatus | undefined;
  if (couponCode) {
    const row = await prisma.coupon.findUnique({ where: { code: couponCode } });
    if (row && couponValidNow(row, new Date())) {
      discountCents = computeDiscountCents(subtotalCents, row);
      coupon = { code: couponCode, applied: true };
    } else {
      coupon = {
        code: couponCode,
        applied: false,
        message: "That coupon code isn’t valid.",
      };
    }
  }

  const totalCents = Math.max(0, subtotalCents - discountCents);
  const result: PricedCart = {
    lines,
    subtotalCents,
    discountCents,
    totalCents,
    coupon,
  };
  return NextResponse.json(result);
}
