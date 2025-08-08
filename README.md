# Slater Street Candles

A Next.js e-commerce starter for a candle shop. Includes:

- Landing page with hero and stock imagery
- About page
- Products grid with mock data
- Cart with add/remove/quantity and subtotal
- API stubs for customers and checkout (Stripe-ready)

## Getting Started

```bash
npm run dev
```

Open http://localhost:3000 to view.

## Database (Prisma + Postgres)

1) Install deps and init Prisma

```bash
npm install prisma @prisma/client
npx prisma init
```

2) Set DATABASE_URL in `.env`

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public
```

3) Migrate and generate client

```bash
npx prisma migrate dev --name init
```

4) Admin basic auth (optional)

Set in `.env` to protect `/admin`:

```
ADMIN_USER=admin
ADMIN_PASS=change-me
```

Then visit http://localhost:3000/admin

## Project Structure

- `src/app/page.tsx` – Landing page with hero + featured products
- `src/app/about/page.tsx` – About page
- `src/app/products/page.tsx` – Products listing
- `src/app/cart/page.tsx` – Cart UI
- `src/components/*` – Header, Footer, ProductCard
- `src/context/CartContext.tsx` – Cart state provider
- `src/data/products.ts` – Mock products
- `src/app/api/checkout/route.ts` – Checkout API (Stripe stub)
- `src/app/api/customers/route.ts` – Customers API (in-memory stub)
- `prisma/schema.prisma` – DB schema
- `src/lib/prisma.ts` – Prisma client singleton
- `src/middleware.ts` – Basic auth for `/admin`
- `src/app/admin/*` – Admin pages (products, inventory, coupons)

## Stripe integration (stub -> real)

1) Install Stripe SDK:

```bash
npm install stripe
```

2) Add `.env.local`:

```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
SITE_URL=http://localhost:3000
```

3) Implement Checkout Session in `src/app/api/checkout/route.ts`:

```ts
// import Stripe from "stripe";
// import { NextRequest, NextResponse } from "next/server";
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-04-30" });
// export async function POST(req: NextRequest) {
//   const { items } = await req.json();
//   const session = await stripe.checkout.sessions.create({
//     mode: "payment",
//     success_url: `${process.env.SITE_URL}/thank-you`,
//     cancel_url: `${process.env.SITE_URL}/cart`,
//     line_items: items.map((i: { name: string; amount: number; quantity: number }) => ({
//       price_data: { currency: "usd", product_data: { name: i.name }, unit_amount: i.amount },
//       quantity: i.quantity,
//     })),
//   });
//   return NextResponse.json({ url: session.url });
// }
```

4) Send cart to API from `src/app/cart/page.tsx`:

```ts
await fetch("/api/checkout", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		items: items.map(({ product, quantity }) => ({
			name: product.name,
			amount: product.price,
			quantity,
		})),
	}),
});
```

## Future backend

- Replace mock `src/app/api/customers/route.ts` with a database (Prisma + Postgres)
- Admin pages for products and orders
- Webhooks endpoint `/api/stripe/webhook` to verify payments and fulfill orders
