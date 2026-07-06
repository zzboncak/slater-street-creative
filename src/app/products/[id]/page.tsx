import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/products";
import AddToCart from "@/components/AddToCart";
import {
  productImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/cloudflare-images";

export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product)
    return {
      title: "Product not found",
      robots: { index: false, follow: false },
    };

  const title = product.name;
  const description = product.description || "Premium hand-poured candle.";
  const base = process.env.SITE_URL || "https://slaterstreetcreative.com";
  const canonical = `${base}/products/${product.id}`;
  // Social/OG image: the real photo or omitted — never the "coming soon" tile.
  const imageUrl = productImageUrl(product.image) ?? undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return notFound();

  const base = process.env.SITE_URL || "https://slaterstreetcreative.com";
  const productLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: productImageUrl(product.image) ?? undefined,
    sku: product.id,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: (product.priceCents / 100).toFixed(2),
      availability: "https://schema.org/InStock",
      url: `${base}/products/${product.id}`,
    },
  };
  const breadcrumbsLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: `${base}/products`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${base}/products/${product.id}`,
      },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 grid gap-8 md:grid-cols-2 items-start">
      <JsonLd data={productLd} />
      <JsonLd data={breadcrumbsLd} />
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
        <Image
          src={productImageUrl(product.image) ?? PRODUCT_IMAGE_PLACEHOLDER}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 600px, 100vw"
          className="object-cover"
        />
      </div>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <div className="text-xl font-bold">
          {formatPrice(product.priceCents)}
        </div>
        {product.description && (
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {product.description}
          </p>
        )}
        <div className="pt-2">
          <AddToCart product={product} />
        </div>
      </div>
    </div>
  );
}
