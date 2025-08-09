import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductById } from "@/data/products";
import type { Product as UIProduct } from "@/types";
import AddToCart from "@/components/AddToCart";

export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

async function loadProduct(id: string): Promise<UIProduct | null> {
  // Try DB if configured
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const p = await prisma.product.findUnique({ where: { id } });
      if (p) {
        return {
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          price: p.priceCents,
          image: p.image ?? "",
          tags: [],
        };
      }
    } catch {
      // ignore and fall back
    }
  }
  // Fallback to mock data (support ids like "classic-vanilla")
  return getProductById(id) ?? null;
}

export default async function ProductDetailsPage({ params }: { params: { id: string } }) {
  const product = await loadProduct(params.id);
  if (!product) return notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 grid gap-8 md:grid-cols-2 items-start">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 600px, 100vw"
          className="object-cover"
        />
      </div>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <div className="text-xl font-bold">{formatPrice(product.price)}</div>
        {product.description && (
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{product.description}</p>
        )}
        <div className="pt-2">
          <AddToCart product={product} />
        </div>
      </div>
    </div>
  );
}
