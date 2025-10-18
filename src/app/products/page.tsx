import ProductCard from "@/components/ProductCard";
import { products as mockProducts } from "@/data/products";
import type { Product as UIProduct } from "@/types";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let list: UIProduct[] = mockProducts;
  try {
    // Only attempt DB fetch if a DATABASE_URL is configured at runtime
    if (process.env.DATABASE_URL) {
      const { prisma } = await import("@/lib/prisma");
      const db: {
        id: string;
        name: string;
        description: string | null;
        priceCents: number;
        image: string | null;
      }[] = await prisma.product.findMany({
        where: { active: true },
        include: { inventory: true },
        orderBy: { name: "asc" },
      });
      if (db.length) {
        list = db.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          price: p.priceCents,
          image: p.image ?? "",
          tags: [],
        }));
      }
    }
  } catch {
    // DB not configured; stick with mock data
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold mb-6">Products</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
