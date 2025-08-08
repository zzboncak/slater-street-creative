import type { Product } from "@/types";

export const products: Product[] = [
  {
    id: "classic-vanilla",
    name: "Classic Vanilla",
    description: "A warm, comforting vanilla scent for any room.",
    price: 1800,
    image:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=60",
    tags: ["vanilla", "warm"],
  },
  {
    id: "lavender-fields",
    name: "Lavender Fields",
    description: "Relaxing lavender aroma, perfect for evenings.",
    price: 2000,
    image:
      "https://images.unsplash.com/photo-1503863937795-62954a3c0f05?w=1200&auto=format&fit=crop&q=60",
    tags: ["lavender", "floral"],
  },
  {
    id: "citrus-breeze",
    name: "Citrus Breeze",
    description: "Bright citrus notes to freshen your space.",
    price: 1900,
    image:
      "https://images.unsplash.com/photo-1505575989282-9576e7b91f0d?w=1200&auto=format&fit=crop&q=60",
    tags: ["citrus", "fresh"],
  },
];

export function getProductById(id: string) {
  return products.find((p) => p.id === id);
}
