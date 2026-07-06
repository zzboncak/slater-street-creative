// Minimal helper for Cloudflare Images
// Storage: save the returned image id (e.g., "abc123/def456") in Product.image.
// Delivery: imagedelivery.net/<account_hash>/<id>/<variant or widthxheight> or custom base.

export const CF_IMAGES = {
  accountId: process.env.CF_ACCOUNT_ID || "",
  token: process.env.CF_IMAGES_TOKEN || "",
  // Optional: custom base like https://imagedelivery.net/<account_hash>
  base:
    process.env.NEXT_PUBLIC_CF_IMAGES_BASE_URL || "https://imagedelivery.net",
};

export const CF_VARIANT = process.env.NEXT_PUBLIC_CF_IMAGES_VARIANT || "public";

/**
 * Build a delivery URL for an image id stored from Cloudflare Images response.
 * @param id The image id (hash/uuid) returned by CF Images after upload
 * @param variant Either a named variant or a sizing like `w=800` (passed through)
 */
export function cfImageUrl(id: string, variant?: string) {
  const trimmed = CF_IMAGES.base.replace(/\/$/, "");
  // If base already includes account hash, keep it; else expect id already contains it (hash/id)
  // Common pattern: base=https://imagedelivery.net/<account_hash> and id=<image_id>
  // Fallback: base=https://imagedelivery.net and id=<account_hash>/<image_id>
  const useVariant = variant ?? CF_VARIANT;
  const path = useVariant ? `${id}/${useVariant}` : id;
  return `${trimmed}/${path}`;
}

/**
 * Resolve a stored product image to a delivery URL, or null when there is none.
 * Absolute URLs pass through unchanged; anything else is treated as a Cloudflare
 * Images id. Centralizes the src logic previously copy-pasted across components.
 */
export function productImageUrl(
  image: string | null | undefined,
  variant?: string,
): string | null {
  if (!image) return null;
  return /^https?:\/\//i.test(image) ? image : cfImageUrl(image, variant);
}

/**
 * Neutral inline placeholder shown while real product photography is pending.
 * A self-contained SVG data URI, so it needs no asset file or image-optimizer
 * config and renders anywhere `next/image` accepts a src.
 */
export const PRODUCT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>" +
      "<rect width='100%' height='100%' fill='#f3efe9'/>" +
      "<text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' " +
      "font-family='ui-sans-serif, system-ui, sans-serif' font-size='16' fill='#a89e8f'>" +
      "Photo coming soon</text></svg>",
  );
