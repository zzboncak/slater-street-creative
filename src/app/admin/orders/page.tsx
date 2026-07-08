import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { markFulfilled } from "./actions";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "FULFILLED",
  "CANCELLED",
  "EXPIRED",
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = STATUSES.includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;

  const orders = await prisma.order.findMany({
    where: active ? { status: active } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/admin/orders"
          className={active ? "underline" : "font-semibold underline"}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={active === s ? "font-semibold underline" : "underline"}
          >
            {s}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">No orders.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Order</th>
              <th>Status</th>
              <th>Email</th>
              <th>Total</th>
              <th>Coupon</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b">
                <td className="py-2">
                  <Link href={`/admin/orders/${o.id}`} className="underline">
                    {o.id.slice(0, 8)}…
                  </Link>
                </td>
                <td>{o.status}</td>
                <td>{o.email}</td>
                <td>{formatPrice(o.totalCents)}</td>
                <td>{o.couponCode ?? "—"}</td>
                <td>{o.createdAt.toISOString().slice(0, 10)}</td>
                <td className="text-right">
                  {o.status === "PAID" && (
                    <form action={markFulfilled} className="inline">
                      <input type="hidden" name="id" value={o.id} />
                      <button className="underline">Mark fulfilled</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
