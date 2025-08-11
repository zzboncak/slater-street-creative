// Minimal helper for Cloudflare Images
// Storage: save the returned image id (e.g., "abc123/def456") in Product.image.
// Delivery: imagedelivery.net/<account_hash>/<id>/<variant or widthxheight> or custom base.

export const CF_IMAGES = {
  accountId: process.env.CF_ACCOUNT_ID || "",
  token: process.env.CF_IMAGES_TOKEN || "",
  // Optional: custom base like https://imagedelivery.net/<account_hash>
  base: process.env.NEXT_PUBLIC_CF_IMAGES_BASE_URL || "https://imagedelivery.net",
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
