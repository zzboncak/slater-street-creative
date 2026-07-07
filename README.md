# Slater Street Candles

A Next.js e-commerce starter for a candle shop. Includes:

- Landing page with hero and stock imagery
- About page
- Products grid with mock data
- Cart with add/remove/quantity and subtotal
- Checkout with server-side re-pricing → Stripe-hosted Checkout

## Getting Started

```bash
npm run dev
```

Open http://localhost:3000 to view.

## Database (Prisma + Postgres)

1. Install deps and init Prisma

```bash
npm install prisma @prisma/client
npx prisma init
```

2. Set environment variables in `.env`

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public
# Signs session tokens. REQUIRED for production builds and at runtime — the app
# throws if unset when NODE_ENV=production (including during `npm run build`).
# In development an insecure fallback is used with a warning.
# Generate one with: openssl rand -hex 32
JWT_SECRET=your_long_random_secret_here
```

3. Migrate and generate client

```bash
npx prisma migrate dev --name init
```

4. Admin access

`/admin` requires a logged-in session with an `ADMIN`-role account — visiting
it without one redirects to `/login`. Signup (`/signup`) creates a regular
`USER`; the seed script (`npm run db:seed`) creates the admin account. Log in
with those credentials, then visit http://localhost:3000/admin

## Project Structure

- `src/app/page.tsx` – Landing page with hero + featured products
- `src/app/about/page.tsx` – About page
- `src/app/products/page.tsx` – Products listing
- `src/app/cart/page.tsx` – Cart UI
- `src/components/*` – Header, Footer, ProductCard
- `src/context/CartContext.tsx` – Cart state provider
- `src/lib/products.ts` – Product reads from the DB (single source of truth)
- `src/app/api/checkout/route.ts` – Checkout: DB re-pricing + Stripe Checkout session
- `src/lib/stripe.ts` – Stripe client singleton (server-only)
- `src/lib/pricing.ts` – Pure pricing/discount helpers (unit-tested)
- `src/app/api/auth/*` – Signup/Login/Logout APIs (email/password with hashed storage + JWT cookie)
- `src/app/(auth)/*` – Signup/Login pages
- `prisma/schema.prisma` – DB schema
- `src/lib/prisma.ts` – Prisma client singleton
- `src/middleware.ts` – Session-cookie gate for `/admin` (redirects to `/login`)
- `src/app/admin/*` – Admin pages (products, inventory, coupons)

## Payments (Stripe Checkout)

Payment uses **Stripe-hosted Checkout** — Stripe handles card data/PCI; we keep
products, inventory, coupons, customers, and orders.

Set a **test** secret key (and optionally the public site origin) in `.env`:

```
STRIPE_SECRET_KEY=sk_test_...   # test key in dev; never commit a real value
SITE_URL=http://localhost:3000  # used for Stripe success/cancel URLs
```

Flow: the cart posts `{ items: [{ productId, quantity }], couponCode? }` to
`POST /api/checkout` (never prices). The server re-prices from the DB, validates
inventory + coupon, creates a **PENDING** `Order`, then creates a Stripe Checkout
Session from the server-computed line items (+ discount), stores the session id
on the order, and returns `{ url }`. The browser is redirected there; success →
`/thank-you?order=<id>`, cancel → `/cart`. Without `STRIPE_SECRET_KEY`, checkout
returns `503`.

Test end-to-end with Stripe test card `4242 4242 4242 4242` (any future expiry,
any CVC).

## Future backend

- **`/api/stripe/webhook`** to verify payment (`checkout.session.completed`),
  mark the order `PAID`, and decrement inventory — the order stays `PENDING`
  until this lands (next ticket).
- Admin pages for orders.

## Local Postgres via Docker (Recommended for Dev)

This repo includes a `docker-compose.yml` defining a Postgres 16 service and a helper script `npm run dev:db` that:

- Starts the DB container (or leaves it running if already up)
- Waits until Postgres is ready to accept connections
- Runs `prisma generate` and applies migrations
- Starts the Next.js dev server

Steps:

1. Optionally create `.env.local` with your connection string (the script defaults to this):

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/slater?schema=public"
```

2. Start dev with DB:

```bash
npm run dev:db
```

DB utilities:

```bash
npm run db:up   # start DB container only
npm run db:down # stop and remove containers
```

## Cloudflare Images (optional)

Configure Cloudflare Images to host product photos.

1. In Cloudflare dashboard, enable Images and create an API Token with Images:Edit.

2. Add to `.env` (see `.env.example`):

```
CF_ACCOUNT_ID=...
CF_IMAGES_TOKEN=...
NEXT_PUBLIC_CF_IMAGES_BASE_URL=https://imagedelivery.net/<account_hash>
```

3. In Admin → Products, use the uploader. It saves the returned image id to the product. Rendering uses Next/Image with domains allowed in `next.config.ts`.
