# AGENTS.md — Slater Street Creative

Guide for AI agents working in this repo. Read before making changes.

## What this is

E-commerce site for Slater Street Candles, a small candle business. Goal: a self-owned store that replaces platforms like Square — landing page, about page, scent catalog, and a full shopping system (cart, checkout, coupon codes, inventory tracking).

## Tech stack

Next.js 15 (App Router) + React 19 + TypeScript (strict) · Tailwind CSS v4 · Prisma 6 + PostgreSQL (Docker locally) · Cloudflare Images for product photos · custom cookie/JWT session auth (`src/lib/auth.ts`) · ESLint 9 + Prettier.

## Commands

```bash
npm run dev:db     # start Postgres container + migrate + dev server (preferred)
npm run dev        # dev server only (assumes DB is already up on port 5433)
npm run db:seed    # seed database (runs prisma/seed.ts via tsx)
npm run lint       # ESLint
npx tsc --noEmit   # typecheck
npm run format     # Prettier
npm test           # Vitest unit tests (run once)
npm run build      # prisma generate + next build
```

Before finishing any task, run: `npx tsc --noEmit && npm run lint && npm run format && npm test`. CI (`.github/workflows/ci.yml`) runs typecheck + lint + test on pushes to `main` and every PR.

## Layout

- `src/app/` — App Router pages. Public: `/`, `/about`, `/candles`, `/products`, `/cart`, `/contact`. Auth pages in `(auth)/`. Admin in `admin/`.
- `src/app/api/` — route handlers (auth, checkout, image upload).
- Admin mutations are inline server actions inside the admin `page.tsx` files.
- `src/lib/auth.ts` — hand-rolled JWT + pbkdf2. `src/lib/prisma.ts` — client singleton.
- `src/context/CartContext.tsx` — client-side cart, persisted to localStorage.
- `prisma/schema.prisma` — Product, Inventory, Customer, Coupon, User, Session, Order, OrderItem.

## Conventions

- Money is always integer cents (`priceCents`). Never floats.
- Server Components by default; add `"use client"` only when needed.
- Feature flags live in `src/lib/flags.ts` (`ecommerceEnabled()` / `checkoutEnabled()`), read from `NEXT_PUBLIC_*` env vars and **fail-closed** (on only when `=== "true"`). Gate both the UI and the server route — never rely on hidden UI alone, especially for the money path. Don't reintroduce `publicRuntimeConfig` (unsupported in the App Router).
- Path alias `@/*` → `src/*`.
- Schema changes: `npx prisma migrate dev --name <descriptive_name>` — never edit applied migrations.
- Commit messages: short imperative summaries, matching existing history.

## Known issues & gotchas

See `AUDIT.md` for the full list. The ones that will bite you:

1. **Admin auth is enforced server-side, not by middleware.** `src/middleware.ts` only checks that a `session` cookie _exists_ (a UX redirect). Every admin server action and the admin layout call `await requireAdmin()` from `src/lib/auth.ts`; route handlers needing a JSON status call `authorizeAdmin()`. Any new admin mutation MUST call one of these as its first line.
2. **Products/cart read from the DB.** The mock is gone; the UI `Product` type is derived from Prisma (`priceCents`/`scentProfile`) via `src/lib/products.ts` (SSC-6a). The cart persists only `{ productId, quantity }` and re-prices via `POST /api/cart` — no client-side prices (SSC-6b). Checkout re-prices the same way (SSC-12).
3. **`/api/checkout` re-prices, creates a PENDING order, and hands off to Stripe Checkout** (SSC-12 + SSC-13). Money math is in `src/lib/pricing.ts` (unit-tested); the Stripe client is `src/lib/stripe.ts` (needs `STRIPE_SECRET_KEY`, else 503) and pins `apiVersion` + `maxNetworkRetries` so checkout and the webhook always speak the same version (SSC-28). **Payment truth comes from the webhook** — `/api/stripe/webhook` (SSC-14) verifies the Stripe signature (`STRIPE_WEBHOOK_SECRET`) and on a paid `checkout.session.completed` marks the order `PAID` + decrements inventory in one idempotent transaction. It also handles async methods (SSC-24): `async_payment_succeeded` fulfills the same way; `async_payment_failed` marks the order `CANCELLED` (no inventory change). On the winning `PENDING`→`PAID` flip the webhook also sends an order-confirmation email via Resend (`src/lib/email.ts`, SSC-18) — **env-dormant** (missing `RESEND_API_KEY`/`EMAIL_FROM` renders + logs instead of sending, never crashes), **at most once** (piggybacks the idempotent claim, so retries don't re-send), and **best-effort** (a send failure is logged after commit, never fails fulfillment). A **$0 total** (full-value coupon) is created directly as `PAID` with inventory committed at checkout — Stripe is skipped; a **1–49¢** total is rejected (`below_minimum`, below Stripe's charge floor) (SSC-23). Checkout is **idempotent per client token**: the browser sends a `checkoutToken` (unique on `Order`) that a retry reuses to reuse/replay the caller's open PENDING order (or 200 a settled one) instead of minting a duplicate; a stale token 409s so the client rotates it (SSC-28). Never trust the browser redirect for payment state.
4. **Coupons/inventory are enforced server-side.** Checkout validates coupon validity + available inventory; the webhook decrements stock (floored at 0) at payment. The cart UI has a coupon field: `/api/cart` returns server-computed discount/total with **soft** feedback for a bad code, while `/api/checkout` **hard**-rejects one (SSC-15). Coupon resolution is centralized in `src/lib/coupons.ts` (SSC-27); `percentOff` is capped at 100 at coupon creation (SSC-23).
5. **Abandoned PENDING orders are swept to `EXPIRED`.** Checkout creates a PENDING order before Stripe; a daily Vercel Cron (`vercel.json`) hits `GET /api/cron/expire-orders` (guarded by `CRON_SECRET`) and marks PENDING orders older than 24h as `EXPIRED` (`src/lib/orders.ts`, SSC-26). No inventory impact — stock is only touched on the paid webhook.
6. **`DATABASE_URL` is required.** `src/lib/prisma.ts` throws at startup if it's unset (including during `next build`). Import the client statically — `import { prisma } from "@/lib/prisma"` — everywhere; the old `if (!process.env.DATABASE_URL)` guards and lazy `await import("@/lib/prisma")` are gone (SSC-8).
7. `.gitignore` ignores `.github/*` **except** `.github/workflows/` (exception in place) — CI workflows are committable; other `.github` files (e.g. copilot instructions) stay ignored.
8. One seed file: `prisma/seed.ts`, run via `tsx` (`npm run db:seed`). It imports the real `hashPassword` from `src/lib/auth` and seeds the ADMIN user, the candle catalog + inventory, and a test coupon.
9. **After changing dependencies, regenerate the lockfile cleanly** (`rm -rf node_modules package-lock.json && npm install`) and confirm `npm ci` passes. An incremental `npm install` on macOS drops Linux-only optional deps (`@emnapi/*`) from the lock, which makes CI's `npm ci` fail on the Linux runner.

## Security rules

- Never commit `.env*` files or print their values.
- Re-price carts server-side from the DB at checkout; never trust client-supplied prices.
- Validate all input server-side; enforce admin access with `requireAdmin()` / `authorizeAdmin()` inside actions/routes, not just middleware.
- Passwords are pbkdf2 with a per-user random salt, stored as `salt:hash` in `User.passwordHash`. `JWT_SECRET` signs session tokens only and is required in production (the app throws at startup if unset; dev uses a warned fallback). Changing the hashing scheme invalidates existing password hashes — re-seed dev accounts.

## Workflow

**Read `WORKFLOW.md`** — it defines the full ticket loop, review gates, branch/commit conventions, and how to find tickets on the Notion Project Board (https://app.notion.com/p/cf97acd3656140579eefdb08c3fb6685). Short version: pick the next sequenced ticket from Up Next, get the plan approved before writing code, one ticket = one PR, the architect merges. Note anything out-of-scope you find rather than fixing it inline.
