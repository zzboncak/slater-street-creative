/**
 * Normalize a scent note's display name to its unique `slug` — the integrity
 * keystone of the Scent table (SSC-32). Lowercase, collapse every run of
 * non-alphanumerics to a single hyphen, and trim leading/trailing hyphens, so
 * "Blue Spruce", "blue spruce", and " Blue  Spruce " all resolve to the same
 * `blue-spruce` and can't split into duplicate rows.
 *
 * IMPORTANT: the backfill migration replicates this exact logic in SQL
 * (`trim(both '-' from regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g'))`).
 * If you change one, change the other, or seeded and migrated slugs diverge.
 */
export function scentSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
