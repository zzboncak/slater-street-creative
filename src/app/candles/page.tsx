import React from "react";

type Product = {
  id: string;
  name: string;
  scentProfile: string[];
  active: boolean;
};

export const dynamic = "force-dynamic";

export default async function CandlesPage() {
  let products: Product[] = [];
  
  if (process.env.DATABASE_URL) {
    const { prisma } = await import("@/lib/prisma");
    products = (await prisma.product.findMany({
      where: { active: true, type: "CANDLE" },
      orderBy: { createdAt: "asc" },
    })) as unknown as Product[];
  }

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
