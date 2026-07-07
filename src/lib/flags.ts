// Feature flags. Public (NEXT_PUBLIC_*) so the same value is readable in both
// server code (routes, server components) and client components. These are not
// secrets — they only decide what's visible/enabled, and every server route
// re-checks them so the UI gate is never the only line of defense.
//
// Fail-closed: a feature is OFF unless its env var is exactly the string "true".
// So an unset/misspelled value in prod hides the feature rather than exposing it.
//
// - ecommerceEnabled(): the whole storefront commerce surface — browsing the
//   purchasable inventory (/products), add-to-cart, the cart, and /api/cart.
//   When off, the public site is just the landing/about/candle-scent pages.
// - checkoutEnabled(): the payment path specifically — the checkout button and
//   /api/checkout. Taking a real payment requires BOTH flags on, so money stays
//   independently locked even after the rest of the store is switched on.

export function ecommerceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ECOMMERCE === "true";
}

export function checkoutEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CHECKOUT === "true";
}
