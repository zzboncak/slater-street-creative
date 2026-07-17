# Code Audit — July 4, 2026

Snapshot audit after ~1 year untouched. TypeScript compiles clean (`tsc --noEmit` passes). The scaffold is in decent shape; the issues below are ranked by severity. Most feed directly into project-board tasks.

## High severity

**A1. ~~Duplicate, conflicting middleware.~~ Resolved (SSC-1).** Root `middleware.ts` deleted; `src/middleware.ts` is the single middleware and redirects `/admin` requests without a `session` cookie to `/login?next=…`. Basic Auth (`ADMIN_USER`/`ADMIN_PASS`) and its env-var fail-open are gone.

**A2. ~~Admin server actions have no auth checks of their own.~~ Resolved (SSC-2; capability-based since SSC-36).** Every admin page/action and the admin layout gate server-side via the capability map in `src/lib/authz.ts` — `requireCapability(cap)` (pages/actions) or `authorizeCapability(cap)` (route handlers, e.g. `/api/images/direct-upload`), each doing a full JWT → DB-session → DB-role check. The middleware presence-check remains a UX redirect only — authorization is enforced in the action/route. (SSC-2 originally added role-literal `requireAdmin()`/`authorizeAdmin()`; SSC-36 replaced those with capabilities and the `CUSTOMER`/`FULFILLMENT`/`ADMIN` roles.)

**A3. ~~`/api/customers` GET is unauthenticated.~~ Resolved (SSC-3).** The route (`src/app/api/customers/route.ts`) was deleted — nothing consumed it, and customer records are created via the signup flow. The unauthenticated GET, anonymous POST, and in-memory fallback store are all gone.

**A4. ~~Password hashing uses `JWT_SECRET` as a static salt.~~ Resolved (SSC-4).** `hashPassword` now uses a per-user random salt (pbkdf2, stored as `salt:hash`); password hashing no longer touches `JWT_SECRET`. The secret signs session tokens only and is required in production (throws at startup if unset; dev-only fallback with a loud warning). `verifyPassword` remains timing-safe and rejects legacy/malformed hashes.

**A5. ~~`verifyJwt` can crash the request.~~ Resolved (SSC-5).** `verifyJwt` now checks signature-buffer length before `timingSafeEqual` (constant-time comparison preserved) and wraps the whole body in try/catch, so any malformed token (wrong part count, bad base64, bad JSON, wrong-length sig) returns `null` instead of throwing a 500.

## Medium severity

**B1. ~~Two sources of truth for products.~~ Partially resolved (SSC-6a).** The mock (`src/data/products.ts`) is deleted; all storefront pages read the DB via `src/lib/products.ts`, and the UI `Product` type is derived from Prisma (`priceCents`/`scentProfile`, no `as unknown as`). Still open: the cart persists full product objects with prices in localStorage — switching to `productId`+`quantity` with server-side re-pricing is SSC-6b (see B4).

**B2. ~~Checkout is a stub.~~ Resolved (SSC-12).** `POST /api/checkout` now re-prices the cart from the DB, validates availability + coupon, and creates a PENDING `Order` + `OrderItem`s in a transaction (models from SSC-11). Still open: taking payment — the Stripe Checkout session + `PAID` webhook is SSC-13.

**B3. ~~Coupons and inventory are decorative.~~ Resolved (SSC-12 + SSC-14).** Checkout validates coupons (active + date window, integer-cents discount) and rejects quantities exceeding inventory (SSC-12); the Stripe webhook (`/api/stripe/webhook`, SSC-14) marks the order PAID and **decrements inventory** atomically/idempotently on payment, flooring at 0 with a logged oversell warning. Remaining nicety (not decorative): no coupon-entry field in the cart UI yet.

**B4. ~~Cart trusts client-side prices.~~ Resolved (SSC-6b, SSC-12).** The cart persists only `{ productId, quantity }`; both cart display (`/api/cart`) and checkout (`/api/checkout`) re-price server-side from the DB. Client-supplied prices are never read.

**B5. ~~No tests, no CI.~~ Resolved (SSC-9).** Vitest configured (`npm test`) with first tests for `src/lib/auth.ts` (hash/verify roundtrip, malformed JWT → null) and the cart reducer. `.gitignore` now allows `.github/workflows/`, and a GitHub Actions workflow runs typecheck + lint + test on pushes to `main` and every PR.

## Low severity / hygiene

- **C1.** ~~Three seed files (`seed.js`, `seed.cjs`, `seed.ts`).~~ Resolved (SSC-7). One `prisma/seed.ts` (run via `tsx`) remains; it imports the real `hashPassword` from `src/lib/auth` (no duplicated crypto) and seeds admin + catalog + a test coupon.
- **C2.** ~~`if (!process.env.DATABASE_URL)` guards + lazy `import("@/lib/prisma")` scattered through routes/pages.~~ Resolved (SSC-8). All removed in favor of a static `import { prisma } from "@/lib/prisma"`; `src/lib/prisma.ts` throws a clear error at startup if `DATABASE_URL` is unset (now required, including at build).
- **C3.** `as unknown as X` casts in admin/candles pages instead of Prisma-generated types.
- **C4.** ~~`eslint-config-next` pinned at 15.4.6 vs `next` (minor drift); deps ~a year old.~~ Resolved (SSC-10). `eslint-config-next` aligned to `next` (15.5.x); `react`/`react-dom` bumped to 19.2.x; `next` (15.5.20) and Prisma (6.19.x) already at latest-within-major. `npm audit` clean of high/critical (2 moderate remain — a postcss advisory pulled in transitively by `next`, unfixable without the Next 16 major).
- **C5.** README's Stripe section and `.github/copilot-instructions.md` roadmap are partly aspirational — they describe things that don't exist yet.
- **C6.** Follow-up (SSC-17): `/account` lists a customer's orders via the `User → Customer` link only. Guest/email-only orders (email matches the user but no `customerId`) aren't shown. Not reachable today — checkout requires a login — but if guest checkout is ever added, decide whether to back-link past email-only orders to the account (e.g. claim-by-email on signup/login).

## What's in good shape

Strict TypeScript passes. Prices stored as integer cents. Prisma schema is sensible (cuid ids, timestamps, cascade rules). Cart reducer is clean. Session revocation (DB-backed `jti`) is checked in `/api/auth/me` and image upload. Prettier + ESLint configured.
