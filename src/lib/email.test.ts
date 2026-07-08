import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderOrderConfirmation, sendOrderConfirmation } from "./email";

// Mock the provider so no test can ever hit the network; assert on the mock to
// prove the dormant path never calls it.
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({ emails: { send: mockSend } })),
}));

const order = {
  id: "ord_abc123",
  email: "buyer@example.com",
  subtotalCents: 4500,
  discountCents: 500,
  totalCents: 4000,
  couponCode: "SAVE5",
};
const items = [
  {
    name: "The Garden",
    unitPriceCents: 1500,
    quantity: 2,
    lineTotalCents: 3000,
  },
  { name: "The Cafe", unitPriceCents: 1500, quantity: 1, lineTotalCents: 1500 },
];

describe("renderOrderConfirmation", () => {
  it("includes items, totals, coupon, and the order id in both parts", () => {
    const { subject, html, text } = renderOrderConfirmation(order, items);
    expect(subject).toMatch(/confirmed/i);
    for (const body of [html, text]) {
      expect(body).toContain("The Garden");
      expect(body).toContain("$40.00"); // total
      expect(body).toContain("$45.00"); // subtotal
      expect(body).toContain("SAVE5"); // coupon
      expect(body).toContain("ord_abc123"); // order reference
    }
  });

  it("omits the discount line when there is no discount", () => {
    const { text } = renderOrderConfirmation(
      { ...order, discountCents: 0, couponCode: null },
      items,
    );
    expect(text).not.toMatch(/discount/i);
  });

  it("HTML-escapes item names so a crafted name can't inject markup", () => {
    const { html, text } = renderOrderConfirmation(order, [
      {
        name: "<script>x</script>",
        unitPriceCents: 100,
        quantity: 1,
        lineTotalCents: 100,
      },
    ]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(text).toContain("<script>"); // text part is not an HTML sink
  });
});

describe("sendOrderConfirmation (env-dormant)", () => {
  beforeEach(() => {
    mockSend.mockReset();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips a non-address recipient without calling the provider or warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      sendOrderConfirmation({ ...order, email: "admin" }, items),
    ).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs and skips (no throw, no provider call) when unconfigured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(sendOrderConfirmation(order, items)).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });
});
