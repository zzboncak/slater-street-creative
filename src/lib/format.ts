// Shared USD price formatter (integer cents → "$X.XX"). Framework/DB-free, so
// both server and client components can import it without a "use client" edge.
export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
