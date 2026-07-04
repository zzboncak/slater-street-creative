# Code Audit — July 4, 2026

Snapshot audit after ~1 year untouched. TypeScript compiles clean (`tsc --noEmit` passes). The scaffold is in decent shape; the issues below are ranked by severity. Most feed directly into project-board tasks.

## High severity

**A1. Duplicate, conflicting middleware.** Both `middleware.ts` (root) and `src/middleware.ts` exist. The build manifest confirms only `src/middleware.ts` (HTTP Basic Auth) runs. The root file (session-cookie redirect to /login) is dead code that implies session protection that doesn't exist. Delete the dead one and consolidate.

**A2. Admin is unprotected if env vars are missing.** `src/middleware.ts` passes ALL requests through when `ADMIN_USER`/`ADMIN_PASS` are unset. The admin server actions (create/delete products, coupons, inventory) contain no auth checks of their own. One misconfigured deploy = fully open admin. Actions should verify an ADMIN-role session server-side, always.

**A3. `/api/customers` GET is unauthenticated.** Returns every customer's email and name to anyone. PII leak. POST also allows anonymous customer creation.

**A4. Password hashing uses `JWT_SECRET` as a static salt.** In `src/lib/auth.ts`, pbkdf2 salts every password with the same value — identical passwords produce identical hashes, and rotating `JWT_SECRET` breaks every login. Also falls back to `"dev-secret-change-me"` if unset (works silently in prod). Replace with per-user salt (or bcrypt/argon2) and require the secret.

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
