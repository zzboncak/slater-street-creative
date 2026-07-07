import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { getActiveProducts } from "@/lib/products";
import { ecommerceEnabled } from "@/lib/flags";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  // Purchasable inventory is part of the gated commerce surface.
  if (!ecommerceEnabled()) notFound();
  const list = await getActiveProducts();

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
