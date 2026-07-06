import type { Product as PrismaProduct } from "@prisma/client";

// UI-facing product shape, derived from the Prisma model — the DB is the single
// source of truth. Nullable columns (description, image) are normalized to "" by
// the data-access helpers in src/lib/products.ts so components don't each handle
// null. Money stays as `priceCents` (integer cents) end to end.
export type Product = Pick<
  PrismaProduct,
  "id" | "name" | "priceCents" | "scentProfile"
> & {
  description: string;
  image: string;
};

// The cart persists only ids + quantities. Prices/details are re-fetched from
// the DB via POST /api/cart so the client never holds authoritative pricing.
export type CartItem = {
  productId: string;
  quantity: number;
};

// A cart line priced server-side (all money computed on the backend).
export type PricedCartLine = {
  productId: string;
  name: string;
  image: string;
  priceCents: number; // unit price
  quantity: number;
  lineTotalCents: number;
};

export type PricedCart = {
  lines: PricedCartLine[];
  subtotalCents: number;
};
