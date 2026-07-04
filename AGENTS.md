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
npm run db:seed    # seed database (runs prisma/seed.js)
npm run lint       # ESLint
npx tsc --noEmit   # typecheck
npm run format     # Prettier
npm run build      # prisma generate + next build
```

There is no test suite yet. Before finishing any task, run: `npx tsc --noEmit && npm run lint && npm run format`.

## Layout

- `src/app/` — App Router pages. Public: `/`, `/about`, `/candles`, `/products`, `/cart`, `/contact`. Auth pages in `(auth)/`. Admin in `admin/`.
- `src/app/api/` — route handlers (auth, checkout, customers, image upload).
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

1. **Admin server actions have no internal auth checks** — `src/middleware.ts` only checks that a `session` cookie _exists_ (no JWT/role verification until SSC-2). Any new mutation touching admin data must verify an ADMIN-role session inside the action itself.
2. **Two product sources of truth**: `src/data/products.ts` (mock) vs the DB. The DB is canonical going forward. UI `Product` type (`price`, `tags`) differs from Prisma (`priceCents`, `scentProfile`).
3. **`/api/checkout` is a stub** and there is no Order model yet.
4. **Coupons and inventory are not enforced anywhere** — CRUD only.
5. `if (!process.env.DATABASE_URL)` guards and lazy prisma imports are legacy; don't copy the pattern into new code.
6. `.gitignore` ignores `.github/*` — adding CI workflows requires a gitignore exception.
7. Three seed files exist; `prisma/seed.js` is the one that runs.

## Security rules

- Never commit `.env*` files or print their values.
- Re-price carts server-side from the DB at checkout; never trust client-supplied prices.
- Validate all input server-side; check `role === "ADMIN"` inside actions/routes, not just middleware.
- Auth code (`src/lib/auth.ts`) has known weaknesses (static-salt pbkdf2, dev-secret fallback) — fix only as part of a scoped task, and be aware changes may invalidate existing password hashes.

## Workflow

**Read `WORKFLOW.md`** — it defines the full ticket loop, review gates, branch/commit conventions, and how to find tickets on the Notion Project Board (https://app.notion.com/p/cf97acd3656140579eefdb08c3fb6685). Short version: pick the next sequenced ticket from Up Next, get the plan approved before writing code, one ticket = one PR, the architect merges. Note anything out-of-scope you find rather than fixing it inline.
