import "server-only";
import type { Prisma, ProductType } from "@prisma/client";
import type { Product } from "@/types";
import { prisma } from "@/lib/prisma";

// Pull a product's scent notes in curated order alongside it (SSC-32). Shared by
// every read below so scent names are always derived from the relation.
const withScents = {
  scents: { orderBy: { position: "asc" }, include: { scent: true } },
} satisfies Prisma.ProductInclude;

type ProductWithScents = Prisma.ProductGetPayload<{
  include: typeof withScents;
}>;

// Single source of truth for reading products: the database. Maps Prisma rows to
// the UI `Product` shape, normalizing nullable columns to "" and flattening the
// ProductScent relation to ordered note names. Server-only so the Prisma client
// never gets pulled into a client bundle.
function toUIProduct(p: ProductWithScents): Product {
  return {
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    scents: p.scents.map((ps) => ps.scent.name),
    description: p.description ?? "",
    image: p.image ?? "",
  };
}

export async function getActiveProducts(
  type?: ProductType,
): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, ...(type ? { type } : {}) },
    orderBy: { name: "asc" },
    include: withScents,
  });
  return rows.map(toUIProduct);
}

export async function getFeaturedProducts(limit = 3): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: withScents,
  });
  return rows.map(toUIProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const p = await prisma.product.findUnique({
    where: { id },
    include: withScents,
  });
  return p ? toUIProduct(p) : null;
}

// Batch read for a set of ids (active only). Used by cart re-pricing so all
// product DB reads stay in this module.
export async function getActiveProductsByIds(
  ids: string[],
): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, active: true },
    include: withScents,
  });
  return rows.map(toUIProduct);
}
