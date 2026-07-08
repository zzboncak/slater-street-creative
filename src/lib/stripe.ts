import Stripe from "stripe";

// Lazily-created Stripe client. Returns null when STRIPE_SECRET_KEY is unset so
// callers can fail cleanly ("payments not configured") instead of crashing.
// The secret key never leaves the server and is never committed.
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) {
    client = new Stripe(key, {
      // Pin the API version explicitly (matches this SDK's default) so a future
      // `stripe` upgrade can't silently shift the request/response shape out from
      // under us. Checkout and the webhook share this one client, so they always
      // speak the same version.
      apiVersion: "2026-06-24.dahlia",
      // Auto-retry transient network / 5xx failures. Safe because every write we
      // make carries an idempotency key (per-order Stripe keys + the checkout
      // token), so a retried request can't double-charge or double-create.
      maxNetworkRetries: 2,
    });
  }
  return client;
}
