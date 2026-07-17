import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/authz";
import { formatPrice } from "@/lib/format";
import { markFulfilled } from "../actions";

export const metadata = { title: "Order" };
export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Gate explicitly on viewOrders (not just the coarse layout gate), matching the
  // orders list — so this page's protection is self-contained.
  await requireCapability("viewOrders");
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="text-sm underline">
        ← All orders
      </Link>

      <div className="space-y-1">
        <h2 className="text-lg font-medium">
          Order <span className="font-mono">{order.id}</span>
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {order.status} · {order.email} · {order.createdAt.toISOString()}
        </p>
        {order.stripeCheckoutSessionId && (
          <p className="text-xs text-gray-500 break-all">
            Stripe session: {order.stripeCheckoutSessionId}
          </p>
        )}
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Item</th>
            <th>Unit</th>
            <th>Qty</th>
            <th className="text-right">Line total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2">{item.name}</td>
              <td>{formatPrice(item.unitPriceCents)}</td>
              <td>{item.quantity}</td>
              <td className="text-right">{formatPrice(item.lineTotalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPrice(order.subtotalCents)}</span>
        </div>
        {order.discountCents > 0 && (
          <div className="flex justify-between">
            <span>
              Discount{order.couponCode ? ` (${order.couponCode})` : ""}
            </span>
            <span>−{formatPrice(order.discountCents)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>
      </div>

      {order.status === "PAID" && (
        <form action={markFulfilled}>
          <input type="hidden" name="id" value={order.id} />
          <button className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm">
            Mark fulfilled
          </button>
        </form>
      )}
    </div>
  );
}
