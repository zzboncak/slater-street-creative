import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ecommerceEnabled } from "@/lib/flags";
import { formatPrice } from "@/lib/format";
import ClearCartOnMount from "./safe-clear";

export const metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  if (!ecommerceEnabled()) notFound();

  // A repeated query param (?order=a&order=b) arrives as an array — treat only
  // a single string as a valid id, else fall through to the generic message.
  const params = await searchParams;
  const orderId = typeof params.order === "string" ? params.order : undefined;
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

  // Affirmative per-status messaging — never imply payment for a non-paid
  // state (e.g. a CANCELLED order must not read as "confirmed").
  const statusMessage: Record<string, string> = {
    PAID: "payment confirmed.",
    SHIPPED: "shipped — it’s on the way.",
    FULFILLED: "delivered.",
    PENDING: "we’re confirming your payment; this page will update shortly.",
    CANCELLED: "this order was cancelled.",
    EXPIRED: "this order expired before payment.",
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Thank you!</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Order <span className="font-mono">{owned.id}</span> —{" "}
          {statusMessage[owned.status] ?? `${owned.status.toLowerCase()}.`}
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
