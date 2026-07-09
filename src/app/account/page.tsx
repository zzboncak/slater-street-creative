import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Account" };
export const dynamic = "force-dynamic";

// Statuses a customer sees: real, paid-through orders (plus a cancelled async
// payment). PENDING / EXPIRED are never-completed checkouts — hidden (SSC-17).
const VISIBLE_STATUSES: OrderStatus[] = [
  "PAID",
  "SHIPPED",
  "FULFILLED",
  "CANCELLED",
];

function statusLabel(status: OrderStatus): string {
  return status[0] + status.slice(1).toLowerCase();
}

export default async function AccountPage() {
  const user = await requireUser("/account");

  // Only this user's own orders, via their own Customer link (never a URL
  // param, so a user can never see someone else's). Guard the null-customerId
  // case to []: `where: { customerId: null }` would match every guest /
  // unlinked-customer order — a leak. Every signed-up customer has a customerId;
  // this only affects the admin/seed user (empty list).
  const orders = user.customerId
    ? await prisma.order.findMany({
        where: {
          customerId: user.customerId,
          status: { in: VISIBLE_STATUSES },
        },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Your account</h1>
        <form action="/api/auth/logout" method="post">
          <button className="rounded border px-3 py-1.5 text-sm">Logout</button>
        </form>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Order history</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You haven’t placed any orders yet.{" "}
            <Link href="/products" className="underline">
              Browse products
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-4">
            {orders.map((o) => (
              <li key={o.id} className="rounded-md border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {o.createdAt.toISOString().slice(0, 10)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      Order {o.id.slice(0, 8)}…
                    </p>
                  </div>
                  <span className="rounded-full border px-2.5 py-0.5 text-xs">
                    {statusLabel(o.status)}
                  </span>
                </div>
                <ul className="text-sm space-y-1">
                  {o.items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-4">
                      <span>
                        {it.quantity} × {it.name}
                      </span>
                      <span>{formatPrice(it.lineTotalCents)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(o.totalCents)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
