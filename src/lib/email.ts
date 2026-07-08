import { Resend } from "resend";
import { formatPrice } from "@/lib/format";

// Env-dormant transactional email (mirrors src/lib/stripe.ts's getStripe): the
// client is null when RESEND_API_KEY is unset, so callers skip sending instead
// of crashing. The key never leaves the server and is never committed.
let client: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

// Minimal shapes the confirmation needs — a subset of Order / OrderItem, so the
// webhook can pass its Prisma rows straight through.
export type OrderForEmail = {
  id: string;
  email: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
};

export type OrderItemForEmail = {
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

// Escape the handful of DB/admin-influenced strings (item names, coupon code,
// order id) before they land in the HTML body. Belt-and-suspenders — mail
// clients sanitize too, but we never hand raw values to an HTML sink.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render the order-confirmation email. Pure (no I/O), so it's unit-tested and
 * usable by the dev-mode logger. Includes line items, subtotal/discount/total,
 * the coupon code (if any), and the order id.
 */
export function renderOrderConfirmation(
  order: OrderForEmail,
  items: OrderItemForEmail[],
): { subject: string; html: string; text: string } {
  const subject = "Your Slater Street Candles order is confirmed";

  const textLines = items.map(
    (i) =>
      `  ${i.quantity} × ${i.name} — ${formatPrice(i.lineTotalCents)}` +
      (i.quantity > 1 ? ` (${formatPrice(i.unitPriceCents)} each)` : ""),
  );
  const text = [
    "Thanks for your order!",
    "",
    "Items:",
    ...textLines,
    "",
    `Subtotal: ${formatPrice(order.subtotalCents)}`,
    ...(order.discountCents > 0
      ? [
          `Discount${order.couponCode ? ` (${order.couponCode})` : ""}: −${formatPrice(order.discountCents)}`,
        ]
      : []),
    `Total: ${formatPrice(order.totalCents)}`,
    "",
    `Order reference: ${order.id}`,
    "",
    "We'll email again when it ships. — Slater Street Candles",
  ].join("\n");

  const rows = items
    .map(
      (i) =>
        `<tr>` +
        `<td style="padding:4px 8px">${i.quantity} × ${escapeHtml(i.name)}</td>` +
        `<td style="padding:4px 8px;text-align:right">${formatPrice(i.lineTotalCents)}</td>` +
        `</tr>`,
    )
    .join("");
  const discountRow =
    order.discountCents > 0
      ? `<tr><td style="padding:4px 8px">Discount${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}</td>` +
        `<td style="padding:4px 8px;text-align:right">−${formatPrice(order.discountCents)}</td></tr>`
      : "";
  const html = [
    `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">`,
    `<h1 style="font-size:18px">Thanks for your order!</h1>`,
    `<table style="width:100%;border-collapse:collapse;font-size:14px">`,
    rows,
    `<tr><td style="padding:4px 8px;border-top:1px solid #eee">Subtotal</td>`,
    `<td style="padding:4px 8px;text-align:right;border-top:1px solid #eee">${formatPrice(order.subtotalCents)}</td></tr>`,
    discountRow,
    `<tr><td style="padding:4px 8px;font-weight:600">Total</td>`,
    `<td style="padding:4px 8px;text-align:right;font-weight:600">${formatPrice(order.totalCents)}</td></tr>`,
    `</table>`,
    `<p style="font-size:12px;color:#666">Order reference: ${escapeHtml(order.id)}</p>`,
    `<p style="font-size:14px">We'll email again when it ships. — Slater Street Candles</p>`,
    `</div>`,
  ].join("");

  return { subject, html, text };
}

/**
 * Send the order-confirmation email. Env-dormant: with no RESEND_API_KEY /
 * EMAIL_FROM it logs the rendered email (the local "catcher") and returns —
 * never calls a provider, never throws for being unconfigured. When a provider
 * error occurs it throws, so the caller (the webhook) can log it without
 * failing fulfillment. Skips non-address recipients (e.g. the seeded "admin").
 */
export async function sendOrderConfirmation(
  order: OrderForEmail,
  items: OrderItemForEmail[],
): Promise<void> {
  if (!order.email.includes("@")) return;

  const { subject, html, text } = renderOrderConfirmation(order, items);
  const resend = getResend();
  const from = process.env.EMAIL_FROM;

  if (!resend || !from) {
    console.warn(
      `[email] order-confirmation skipped (RESEND_API_KEY/EMAIL_FROM unset) — would send to ${order.email}: "${subject}"`,
    );
    console.info(`[email] rendered body:\n${text}`);
    return;
  }

  const { error } = await resend.emails.send({
    from,
    to: order.email,
    subject,
    html,
    text,
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
