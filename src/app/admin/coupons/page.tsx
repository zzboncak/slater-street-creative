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
};

export default async function AdminCouponsPage() {
  let coupons: Coupon[] = [];
  if (process.env.DATABASE_URL) {
    const { prisma } = await import("@/lib/prisma");
    coupons = (await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    })) as unknown as Coupon[];
  }
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
            className="border rounded px-2 py-1"
          />
          <input
            name="amountOff"
            placeholder="Amount off (cents)"
            type="number"
            className="border rounded px-2 py-1"
          />
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
                <form
                  action={deleteCoupon}
                  className="inline"
                  onSubmit={(e) => {
                    if (!confirm("Delete coupon?")) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-red-600 underline">Delete</button>
                </form>
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
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const percentOff = formData.get("percentOff");
  const amountOff = formData.get("amountOff");
  const description = String(formData.get("description") || "").trim() || null;
  const validFromStr = String(formData.get("validFrom") || "");
  const validToStr = String(formData.get("validTo") || "");
  const data: Omit<Coupon, "id" | "createdAt"> = {
    code,
    description,
    active: true,
    percentOff: percentOff ? Number(percentOff) : null,
    amountOff: amountOff ? Number(amountOff) : null,
    validFrom: validFromStr ? new Date(validFromStr) : null,
    validTo: validToStr ? new Date(validToStr) : null,
  };
  if (!code) return;
  if (!process.env.DATABASE_URL) return;
  const { prisma } = await import("@/lib/prisma");
  await prisma.coupon.create({ data });
}

async function toggleActive(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  if (!process.env.DATABASE_URL) return;
  const { prisma } = await import("@/lib/prisma");
  const c = await prisma.coupon.findUnique({ where: { id } });
  if (!c) return;
  await prisma.coupon.update({ where: { id }, data: { active: !c.active } });
}

async function deleteCoupon(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  if (!process.env.DATABASE_URL) return;
  const { prisma } = await import("@/lib/prisma");
  await prisma.coupon.delete({ where: { id } }).catch(() => {});
}
