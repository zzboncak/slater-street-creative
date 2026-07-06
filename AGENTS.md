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
npm run build      # prisma generate + next build
```

There is no test suite yet. Before finishing any task, run: `npx tsc --noEmit && npm run lint && npm run format`.

## Layout

- `src/app/` — App Router pages. Public: `/`, `/about`, `/candles`, `/products`, `/cart`, `/contact`. Auth pages in `(auth)/`. Admin in `admin/`.
- `src/app/api/` — route handlers (auth, checkout, image upload).
- Admin mutations are inline server actions inside the admin `page.tsx` files.
- `src/lib/auth.ts` — hand-rolled JWT + pbkdf2. `src/lib/prisma.ts` — client singleton.
- `src/context/CartContext.tsx` — client-side cart, persisted to localStorage.
- `prisma/schema.prisma` — Product, Inventory, Customer, Coupon, User, Session.

## Conventions

- Money is always integer cents (`priceCents`). Never floats.
- Server Components by default; add `"use client"` only when needed.
- Path alias `@/*` → `src/*`.
- Schema changes: `npx prisma migrate dev --name <descriptive_name>` — never edit applied migrations.
- Commit messages: short imperative summaries, matching existing history.

## Known issues & gotchas

See `AUDIT.md` for the full list. The ones that will bite you:

1. **Admin auth is enforced server-side, not by middleware.** `src/middleware.ts` only checks that a `session` cookie _exists_ (a UX redirect). Every admin server action and the admin layout call `await requireAdmin()` from `src/lib/auth.ts`; route handlers needing a JSON status call `authorizeAdmin()`. Any new admin mutation MUST call one of these as its first line.
2. **Cart still trusts client-side prices.** Products now come only from the DB — the mock is gone and the UI `Product` type is derived from Prisma (`priceCents`/`scentProfile`), read via `src/lib/products.ts` (SSC-6a). The remaining gap: the cart persists full product snapshots (incl. price) in localStorage; storing `productId`+`quantity` and re-pricing server-side is SSC-6b (AUDIT B1/B4).
3. **`/api/checkout` is a stub** and there is no Order model yet.
4. **Coupons and inventory are not enforced anywhere** — CRUD only.
5. `if (!process.env.DATABASE_URL)` guards and lazy prisma imports are legacy; don't copy the pattern into new code.
6. `.gitignore` ignores `.github/*` — adding CI workflows requires a gitignore exception.
7. One seed file: `prisma/seed.ts`, run via `tsx` (`npm run db:seed`). It imports the real `hashPassword` from `src/lib/auth` and seeds the ADMIN user, the candle catalog + inventory, and a test coupon.

## Security rules

- Never commit `.env*` files or print their values.
- Re-price carts server-side from the DB at checkout; never trust client-supplied prices.
- Validate all input server-side; enforce admin access with `requireAdmin()` / `authorizeAdmin()` inside actions/routes, not just middleware.
- Passwords are pbkdf2 with a per-user random salt, stored as `salt:hash` in `User.passwordHash`. `JWT_SECRET` signs session tokens only and is required in production (the app throws at startup if unset; dev uses a warned fallback). Changing the hashing scheme invalidates existing password hashes — re-seed dev accounts.

## Workflow

**Read `WORKFLOW.md`** — it defines the full ticket loop, review gates, branch/commit conventions, and how to find tickets on the Notion Project Board (https://app.notion.com/p/cf97acd3656140579eefdb08c3fb6685). Short version: pick the next sequenced ticket from Up Next, get the plan approved before writing code, one ticket = one PR, the architect merges. Note anything out-of-scope you find rather than fixing it inline.
