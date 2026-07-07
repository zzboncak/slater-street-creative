import Stripe from "stripe";

// Lazily-created Stripe client. Returns null when STRIPE_SECRET_KEY is unset so
// callers can fail cleanly ("payments not configured") instead of crashing.
// The secret key never leaves the server and is never committed.
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key); // uses the SDK's pinned API version
  return client;
}
