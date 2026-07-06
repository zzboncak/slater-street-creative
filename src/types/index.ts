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

export type CartItem = {
  product: Product;
  quantity: number;
};
