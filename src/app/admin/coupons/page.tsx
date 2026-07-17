import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import ConfirmDeleteForm from "@/components/admin/ConfirmDeleteForm";

export const dynamic = "force-dynamic";
type Coupon = {
  id: string;
  code: string;
  description: string | null;
  percentOff: number | null;
  amountOff: number | null;
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt: Date;
  maxRedemptions: number | null;
  perUserLimit: number | null;
  usedCount: number;
  allowFreeOrders: boolean;
};

export default async function AdminCouponsPage() {
  await requireCapability("manageCoupons");
  const coupons = (await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  })) as unknown as Coupon[];
  return (
    <div className="space-y-6">
      <form action={createCoupon} className="border rounded p-4 space-y-2">
        <h2 className="font-medium">Add coupon</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            name="code"
            placeholder="CODE"
            className="border rounded px-2 py-1"
            required
          />
          <input
            name="percentOff"
            placeholder="Percent off (0-100)"
            type="number"
            min={0}
            max={100}
            className="border rounded px-2 py-1"
          />
          <input
            name="amountOff"
            placeholder="Amount off (cents)"
            type="number"
            min={0}
            className="border rounded px-2 py-1"
          />
          <input
            name="maxRedemptions"
            placeholder="Max redemptions (blank = ∞)"
            type="number"
            min={0}
            className="border rounded px-2 py-1"
          />
          <input
            name="perUserLimit"
            placeholder="Per-user limit (blank = ∞)"
            type="number"
            min={0}
            className="border rounded px-2 py-1"
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="allowFreeOrders" />
            Allow $0 orders (a full-value coupon can complete without payment)
          </label>
          <input
            name="validFrom"
            placeholder="Valid from (YYYY-MM-DD)"
            className="border rounded px-2 py-1"
          />
          <input
            name="validTo"
            placeholder="Valid to (YYYY-MM-DD)"
            className="border rounded px-2 py-1"
          />
          <input
            name="description"
            placeholder="Description"
            className="border rounded px-2 py-1 sm:col-span-2"
          />
        </div>
        <button className="rounded bg-black text-white px-3 py-1.5">
          Create
        </button>
      </form>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Code</th>
            <th>Percent</th>
            <th>Amount</th>
            <th>Redemptions</th>
            <th>Per-user</th>
            <th>$0</th>
            <th>Active</th>
            <th>Range</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((c: Coupon) => (
            <tr key={c.id} className="border-b">
              <td className="py-2">{c.code}</td>
              <td>{c.percentOff ?? "-"}</td>
              <td>{c.amountOff ?? "-"}</td>
              <td>{`${c.usedCount} / ${c.maxRedemptions ?? "∞"}`}</td>
              <td>{c.perUserLimit ?? "∞"}</td>
              <td>{c.allowFreeOrders ? "Yes" : "-"}</td>
              <td>{c.active ? "Yes" : "No"}</td>
              <td>
                {[
                  c.validFrom?.toISOString().slice(0, 10),
                  c.validTo?.toISOString().slice(0, 10),
                ]
                  .filter(Boolean)
                  .join(" → ") || "-"}
              </td>
              <td className="text-right">
                <form action={toggleActive} className="inline">
                  <input type="hidden" name="id" value={c.id} />
                  <button className="underline mr-3">
                    {c.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <ConfirmDeleteForm
                  action={deleteCoupon}
                  id={c.id}
                  confirmText="Delete coupon?"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function createCoupon(formData: FormData) {
  "use server";
  await requireCapability("manageCoupons");
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const percentRaw = Number(formData.get("percentOff"));
  const amountRaw = Number(formData.get("amountOff"));
  const maxRedRaw = Number(formData.get("maxRedemptions"));
  const perUserRaw = Number(formData.get("perUserLimit"));
  const description = String(formData.get("description") || "").trim() || null;
  const validFromStr = String(formData.get("validFrom") || "");
  const validToStr = String(formData.get("validTo") || "");
  const data: Omit<Coupon, "id" | "createdAt"> = {
    code,
    description,
    active: true,
    // Cap percentOff at 100 and floor both at 0, so an out-of-range coupon can't
    // be created (a >100% coupon would over-discount an order; SSC-23).
    percentOff:
      formData.get("percentOff") && Number.isFinite(percentRaw)
        ? Math.min(100, Math.max(0, Math.round(percentRaw)))
        : null,
    amountOff:
      formData.get("amountOff") && Number.isFinite(amountRaw)
        ? Math.max(0, Math.round(amountRaw))
        : null,
    // Redemption limits — blank = null (unlimited); floored at 0 (SSC-30).
    maxRedemptions:
      formData.get("maxRedemptions") && Number.isFinite(maxRedRaw)
        ? Math.max(0, Math.round(maxRedRaw))
        : null,
    perUserLimit:
      formData.get("perUserLimit") && Number.isFinite(perUserRaw)
        ? Math.max(0, Math.round(perUserRaw))
        : null,
    usedCount: 0,
    allowFreeOrders: !!formData.get("allowFreeOrders"),
    validFrom: validFromStr ? new Date(validFromStr) : null,
    validTo: validToStr ? new Date(validToStr) : null,
  };
  if (!code) return;
  await prisma.coupon.create({ data });
}

async function toggleActive(formData: FormData) {
  "use server";
  await requireCapability("manageCoupons");
  const id = String(formData.get("id"));
  const c = await prisma.coupon.findUnique({ where: { id } });
  if (!c) return;
  await prisma.coupon.update({ where: { id }, data: { active: !c.active } });
}

async function deleteCoupon(formData: FormData) {
  "use server";
  await requireCapability("manageCoupons");
  const id = String(formData.get("id"));
  await prisma.coupon.delete({ where: { id } }).catch(() => {});
}
