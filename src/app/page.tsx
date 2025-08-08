import Image from "next/image";
import Link from "next/link";
import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";

export default function Home() {
  const featured = products.slice(0, 3);
  return (
    <div>
      {/* Hero */}
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10">
          <Image
            src="https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&auto=format&fit=crop&q=60"
            alt="Candles background"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-28 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">Hand-poured candles for cozy spaces</h1>
          <p className="mt-4 text-lg/7 max-w-2xl mx-auto text-white/90">
            Small-batch, natural wax candles crafted to elevate your everyday rituals.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/products" className="rounded-md bg-white text-black px-5 py-3 font-medium hover:opacity-90">
              Shop candles
            </Link>
            <Link href="/about" className="rounded-md bg-white/10 text-white px-5 py-3 font-medium hover:bg-white/20">
              Learn more
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl font-semibold">Featured</h2>
          <Link href="/products" className="text-sm underline">View all</Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
