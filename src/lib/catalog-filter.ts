import type { Product } from "@/types";

// Case-insensitive substring test. `needle` is expected pre-lowercased by the
// caller so we only lowercase each haystack once.
function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

/**
 * Sorted, de-duplicated scent notes across a product list — drives the filter
 * pills. Pure (framework-free) so it runs on the server (to build the pill list)
 * and is unit-testable. When search moves server-side (SSC-33) the pill list will
 * come straight from the Scent table instead of flattening each product.
 */
export function distinctScents(products: Pick<Product, "scents">[]): string[] {
  const set = new Set<string>();
  for (const p of products) for (const s of p.scents) set.add(s);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Filter the catalog by a free-text query (matches name, description, or any
 * scent note — case-insensitive substring) AND, when set, an exact scent note.
 * Pure and framework-free so the client component can run it as-you-type and it
 * stays unit-tested. Catalog data itself still comes from the DB; this is only
 * display filtering of an already-loaded list.
 */
export function filterProducts(
  products: Product[],
  { q, scent }: { q?: string; scent?: string | null },
): Product[] {
  const needle = (q ?? "").trim().toLowerCase();
  return products.filter((p) => {
    if (scent && !p.scents.includes(scent)) return false;
    if (!needle) return true;
    return (
      includesCI(p.name, needle) ||
      includesCI(p.description, needle) ||
      p.scents.some((s) => includesCI(s, needle))
    );
  });
}
