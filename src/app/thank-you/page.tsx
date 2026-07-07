import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ecommerceEnabled } from "@/lib/flags";
import ClearCartOnMount from "./safe-clear";

export const metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  if (!ecommerceEnabled()) notFound();

  const { order: orderId } = await searchParams;
  const user = await getSessionUser();

  // Load the order only if it exists AND belongs to the logged-in user
  // (order.email is set from the session at checkout, and email is unique).
  // Otherwise show a generic message — never leak another customer's order.
  const order =
    orderId && user
      ? await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        })
      : null;
  const owned = order && user && order.email === user.email ? order : null;

  if (!owned) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 space-y-4">
        <h1 className="text-3xl font-semibold">Thank you!</h1>
        <p>
          Your order has been received. A confirmation email will be sent
          shortly.
        </p>
      </div>
    );
  }

  const confirmed = owned.status !== "PENDING";
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Thank you!</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Order <span className="font-mono">{owned.id}</span> —{" "}
          {confirmed
            ? "payment confirmed."
            : "we’re confirming your payment; this page will update shortly."}
        </p>
      </div>

      <ul className="divide-y rounded-md border">
        {owned.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatPrice(item.lineTotalCents)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPrice(owned.subtotalCents)}</span>
        </div>
        {owned.discountCents > 0 && (
          <div className="flex justify-between text-green-700 dark:text-green-400">
            <span>
              Discount{owned.couponCode ? ` (${owned.couponCode})` : ""}
            </span>
            <span>−{formatPrice(owned.discountCents)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatPrice(owned.totalCents)}</span>
        </div>
      </div>

      {/* A real, owned order loaded → safe to clear the cart. */}
      <ClearCartOnMount />
    </div>
  );
}
