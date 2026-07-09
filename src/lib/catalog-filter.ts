import type { Product } from "@/types";

// Case-insensitive substring test. `needle` is expected pre-lowercased by the
// caller so we only lowercase each haystack once.
function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

/**
 * Sorted, de-duplicated scent notes across a product list — drives the filter
 * pills. Pure (framework-free) so it runs on the server (to build the pill list)
 * and is unit-testable. When the catalog outgrows this in-memory pass, swap for a
 * `SELECT DISTINCT unnest(scentProfile)` (SSC-19 "define fully when it grows").
 */
export function distinctScents(
  products: Pick<Product, "scentProfile">[],
): string[] {
  const set = new Set<string>();
  for (const p of products) for (const s of p.scentProfile) set.add(s);
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
    if (scent && !p.scentProfile.includes(scent)) return false;
    if (!needle) return true;
    return (
      includesCI(p.name, needle) ||
      includesCI(p.description, needle) ||
      p.scentProfile.some((s) => includesCI(s, needle))
    );
  });
}
