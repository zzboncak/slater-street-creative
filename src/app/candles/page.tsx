import { getActiveProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function CandlesPage() {
  const products = await getActiveProducts("CANDLE");

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-4xl font-light text-center mb-12">
        Candle Scent Catalog
      </h1>
      <div className="space-y-4 text-base leading-relaxed tracking-wide text-center font-light">
        {products.map((product) => (
          <p key={product.id}>
            <span className="font-bold">{product.name}</span> —{" "}
            {product.scentProfile.join(" | ")}
          </p>
        ))}
      </div>
    </div>
  );
}
