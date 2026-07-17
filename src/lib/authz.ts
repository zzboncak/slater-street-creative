import type { Role, User } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

/**
 * Capability-based authorization (SSC-36).
 *
 * Roles never gate features directly. A role maps to a set of *capabilities*,
 * and every admin surface checks a capability — so "what can this role do" lives
 * in ONE table here. Adding a role, or moving a permission between roles, is a
 * one-line change instead of a sweep across every page and action.
 */
export type Capability =
  | "manageProducts" // create/edit/delete products + the scent vocabulary
  | "manageCoupons"
  | "manageInventory"
  | "manageImages" // mint Cloudflare Images direct-upload tokens
  | "viewOrders"
  | "fulfillOrders"; // PAID → FULFILLED

// The single source of truth for admin authorization: which roles hold each
// capability. ADMIN holds everything; FULFILLMENT is scoped to the order queue;
// CUSTOMER holds nothing admin-facing (it appears in no list).
const CAPABILITY_ROLES: Record<Capability, readonly Role[]> = {
  manageProducts: ["ADMIN"],
  manageCoupons: ["ADMIN"],
  manageInventory: ["ADMIN"],
  manageImages: ["ADMIN"],
  viewOrders: ["ADMIN", "FULFILLMENT"],
  fulfillOrders: ["ADMIN", "FULFILLMENT"],
};

export function roleHasCapability(role: Role, cap: Capability): boolean {
  return CAPABILITY_ROLES[cap].includes(role);
}

/**
 * True when a role holds at least one capability — i.e. belongs in the admin
 * area at all. CUSTOMER → false; ADMIN / FULFILLMENT → true.
 */
export function hasAnyCapability(role: Role): boolean {
  return (Object.keys(CAPABILITY_ROLES) as Capability[]).some((cap) =>
    roleHasCapability(role, cap),
  );
}

type AuthorizeResult =
  { ok: true; user: User } | { ok: false; status: 401 | 403 };

/**
 * Capability check for route handlers that need to return a JSON status.
 * Fails closed: 401 = no usable session; 403 = a valid session whose role lacks
 * `cap`. The role is read fresh from the DB (via getSessionUser), so a demotion
 * takes effect on the very next request — it is never trusted from the JWT.
 */
export async function authorizeCapability(
  cap: Capability,
): Promise<AuthorizeResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401 };
  if (!roleHasCapability(user.role, cap)) return { ok: false, status: 403 };
  return { ok: true, user };
}

/**
 * Capability gate for admin pages and server actions: returns the user, or
 * REDIRECTS (never returns) on failure —
 *   - no session → /login (preserving intent via ?next=/admin)
 *   - a CUSTOMER (no admin capabilities at all) → /login too: they don't belong
 *     in the admin area, so bounce them to sign in as someone who does
 *   - a signed-in admin-area user who lacks THIS capability (e.g. a FULFILLMENT
 *     user opening Products) → /admin, the area's neutral landing they can load
 *
 * Use authorizeCapability() instead when a handler needs a JSON status.
 */
export async function requireCapability(cap: Capability): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!roleHasCapability(user.role, cap)) {
    redirect(hasAnyCapability(user.role) ? "/admin" : "/login?next=/admin");
  }
  return user;
}

/**
 * Coarse gate for the admin *layout*: admit anyone with admin-area access (any
 * capability — ADMIN or FULFILLMENT) and redirect everyone else to login. Each
 * page, action, and route still enforces its specific capability on top of this,
 * so this is the outer boundary, not the whole check.
 */
export async function requireAdminArea(): Promise<User> {
  const user = await getSessionUser();
  if (!user || !hasAnyCapability(user.role)) redirect("/login?next=/admin");
  return user;
}
