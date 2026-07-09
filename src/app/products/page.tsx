import { notFound } from "next/navigation";
import ProductCatalog from "@/components/ProductCatalog";
import { getActiveProducts } from "@/lib/products";
import { distinctScents } from "@/lib/catalog-filter";
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
      {/* Catalog data comes from the DB (server); search/filter is client-side
          over that loaded list for instant, as-you-type UX (SSC-19). */}
      <ProductCatalog products={list} scents={distinctScents(list)} />
    </div>
  );
}
