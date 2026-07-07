import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  normalizeRequestedItems,
  computeDiscountCents,
  couponValidNow,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Thrown inside the transaction to abort it and map to an HTTP response.
class CheckoutError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * Checkout: re-price the cart from the DB, validate inventory and any coupon,
 * and create a PENDING order — all server-side. The client sends only
 * { items: [{productId, quantity}], couponCode? } and never any prices.
 * Requires an authenticated session (the order's email/customer come from it).
 * Inventory is validated but NOT decremented here; stock is committed at payment.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to check out.", code: "auth_required" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const wanted = normalizeRequestedItems(body);
  if (wanted.size === 0) {
    return NextResponse.json(
      { error: "Your cart is empty.", code: "empty_cart" },
      { status: 400 },
    );
  }
  const couponCode =
    typeof body?.couponCode === "string"
      ? body.couponCode.trim().toUpperCase()
      : null;

  try {
    const order = await prisma.$transaction(async (tx) => {
      const ids = [...wanted.keys()];
      const products = await tx.product.findMany({
        where: { id: { in: ids }, active: true },
        include: { inventory: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      // Every requested product must exist and be active.
      const unavailable = ids.filter((id) => !byId.has(id));
      if (unavailable.length) {
        throw new CheckoutError(
          409,
          "unavailable",
          "Some items are no longer available.",
          { productIds: unavailable },
        );
      }

      // Re-price from the DB and snapshot name/price onto each line.
      const insufficient: string[] = [];
      const lineData = ids.map((id) => {
        const p = byId.get(id)!;
        const quantity = wanted.get(id)!;
        const stock = p.inventory?.quantity ?? 0;
        if (quantity > stock) insufficient.push(id);
        return {
          productId: p.id,
          name: p.name,
          unitPriceCents: p.priceCents,
          quantity,
          lineTotalCents: p.priceCents * quantity,
        };
      });
      if (insufficient.length) {
        throw new CheckoutError(
          409,
          "insufficient_stock",
          "There isn't enough stock for some items.",
          { productIds: insufficient },
        );
      }

      const subtotalCents = lineData.reduce((s, l) => s + l.lineTotalCents, 0);

      // Optional coupon: must exist, be active, and be within its date window.
      let discountCents = 0;
      let couponPercentOff: number | null = null;
      let couponAmountOff: number | null = null;
      let couponSnapshotCode: string | null = null;
      if (couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: couponCode },
        });
        if (!coupon || !couponValidNow(coupon, new Date())) {
          throw new CheckoutError(
            400,
            "invalid_coupon",
            "That coupon code is not valid.",
          );
        }
        discountCents = computeDiscountCents(subtotalCents, coupon);
        couponPercentOff = coupon.percentOff;
        couponAmountOff = coupon.amountOff;
        couponSnapshotCode = coupon.code;
      }

      const totalCents = Math.max(0, subtotalCents - discountCents);

      return tx.order.create({
        data: {
          customerId: user.customerId ?? null,
          email: user.email,
          status: "PENDING",
          subtotalCents,
          discountCents,
          totalCents,
          couponCode: couponSnapshotCode,
          couponPercentOff,
          couponAmountOff,
          items: { create: lineData },
        },
        select: {
          id: true,
          status: true,
          subtotalCents: true,
          discountCents: true,
          totalCents: true,
        },
      });
    });

    return NextResponse.json(order, { status: 201 });
  } catch (e) {
    if (e instanceof CheckoutError) {
      return NextResponse.json(
        { error: e.message, code: e.code, ...e.data },
        { status: e.status },
      );
    }
    throw e; // unexpected → 500
  }
}
