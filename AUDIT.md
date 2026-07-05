# Code Audit — July 4, 2026

Snapshot audit after ~1 year untouched. TypeScript compiles clean (`tsc --noEmit` passes). The scaffold is in decent shape; the issues below are ranked by severity. Most feed directly into project-board tasks.

## High severity

**A1. ~~Duplicate, conflicting middleware.~~ Resolved (SSC-1).** Root `middleware.ts` deleted; `src/middleware.ts` is the single middleware and redirects `/admin` requests without a `session` cookie to `/login?next=…`. Basic Auth (`ADMIN_USER`/`ADMIN_PASS`) and its env-var fail-open are gone.

**A2. ~~Admin server actions have no auth checks of their own.~~ Resolved (SSC-2).** `requireAdmin()` in `src/lib/auth.ts` (full JWT + ADMIN role + DB-session check) is called at the top of every admin server action and the admin layout; `/api/images/direct-upload` uses the shared `authorizeAdmin()`. Middleware presence-check remains a UX redirect only — authorization is enforced server-side in the action/route.

**A3. ~~`/api/customers` GET is unauthenticated.~~ Resolved (SSC-3).** The route (`src/app/api/customers/route.ts`) was deleted — nothing consumed it, and customer records are created via the signup flow. The unauthenticated GET, anonymous POST, and in-memory fallback store are all gone.

**A4. ~~Password hashing uses `JWT_SECRET` as a static salt.~~ Resolved (SSC-4).** `hashPassword` now uses a per-user random salt (pbkdf2, stored as `salt:hash`); password hashing no longer touches `JWT_SECRET`. The secret signs session tokens only and is required in production (throws at startup if unset; dev-only fallback with a loud warning). `verifyPassword` remains timing-safe and rejects legacy/malformed hashes.

**A5. `verifyJwt` can crash the request.** `crypto.timingSafeEqual` throws when buffer lengths differ, so a malformed session cookie causes a 500 instead of returning null. Wrap in try/catch.

## Medium severity

**B1. Two sources of truth for products.** `src/data/products.ts` (mock) and the Prisma `Product` model coexist; `/products` merges them at runtime. Two incompatible `Product` types: `src/types` uses `price`/`tags`, Prisma uses `priceCents`/`scentProfile`. Pick the DB, delete the mocks, derive UI types from Prisma.

**B2. Checkout is a stub; no Order model.** `/api/checkout` returns a fake thank-you URL. The schema has no Order/OrderItem — nothing can be recorded, priced, or fulfilled. This is the biggest functional gap vs. the "replace Square" goal.

**B3. Coupons and inventory are decorative.** Admin CRUD exists but coupons are never applied and inventory is never decremented or checked at purchase time.

**B4. Cart trusts client-side prices.** Full product objects (including price) live in localStorage. Checkout must re-price everything server-side from the DB.

**B5. No tests, no CI.** No test framework, no workflows. Note: `.gitignore` ignores `.github/*`, which will silently block committing CI workflows.

## Low severity / hygiene

- **C1.** Three seed files (`seed.js`, `seed.cjs`, `seed.ts`); `npm run db:seed` runs `seed.js`. Keep one.
- **C2.** `if (!process.env.DATABASE_URL)` guards + lazy `import("@/lib/prisma")` scattered through routes/pages — legacy from the mock-data era; noise once DB is required.
- **C3.** `as unknown as X` casts in admin/candles pages instead of Prisma-generated types.
- **C4.** `eslint-config-next` pinned at 15.4.6 vs `next` ^15.5.5 (minor drift). Dependencies overall are a year old.
- **C5.** README's Stripe section and `.github/copilot-instructions.md` roadmap are partly aspirational — they describe things that don't exist yet.

## What's in good shape

Strict TypeScript passes. Prices stored as integer cents. Prisma schema is sensible (cuid ids, timestamps, cascade rules). Cart reducer is clean. Session revocation (DB-backed `jti`) is checked in `/api/auth/me` and image upload. Prettier + ESLint configured.
