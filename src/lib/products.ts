import "server-only";
import type { Product as PrismaProduct, ProductType } from "@prisma/client";
import type { Product } from "@/types";
import { prisma } from "@/lib/prisma";

// Single source of truth for reading products: the database. Maps Prisma rows to
// the UI `Product` shape, normalizing nullable columns to "". Server-only so the
// Prisma client never gets pulled into a client bundle.
function toUIProduct(p: PrismaProduct): Product {
  return {
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    scentProfile: p.scentProfile,
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
  });
  return rows.map(toUIProduct);
}

export async function getFeaturedProducts(limit = 3): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return rows.map(toUIProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const p = await prisma.product.findUnique({ where: { id } });
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
  });
  return rows.map(toUIProduct);
}
