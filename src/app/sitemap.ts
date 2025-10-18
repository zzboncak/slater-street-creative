import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.SITE_URL || "https://slaterstreetcreative.com";
  const pages: MetadataRoute.Sitemap = [
    {
      url: `${site}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${site}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${site}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  try {
    if (process.env.DATABASE_URL) {
      const { prisma } = await import("@/lib/prisma");
      const products: { id: string; updatedAt: Date }[] =
        await prisma.product.findMany({
          where: { active: true },
          select: { id: true, updatedAt: true },
        });
      pages.push(
        ...products.map((p) => ({
          url: `${site}/products/${p.id}`,
          lastModified: p.updatedAt ?? new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
      );
    } else {
      const mod = await import("@/data/products");
      const mockProducts: { id: string }[] = mod.products;
      pages.push(
        ...mockProducts.map((p) => ({
          url: `${site}/products/${p.id}`,
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.6,
        })),
      );
    }
  } catch {
    // ignore enrichment errors
  }

  return pages;
}
