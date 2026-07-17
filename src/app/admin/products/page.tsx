import CFImageField from "@/components/admin/ImageField";
import { ProductType } from "@prisma/client";
import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
  inventory: { quantity: number } | null;
  scents: { scent: { name: string } }[];
};

export default async function AdminProductsPage() {
  // The layout admits FULFILLMENT into the admin area; product management is
  // ADMIN-only, so gate the page itself (not just the actions).
  await requireCapability("manageProducts");
  const [products, scentOptions] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        inventory: true,
        scents: { orderBy: { position: "asc" }, include: { scent: true } },
      },
    }) as unknown as Promise<ProductRow[]>,
    prisma.scent.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <form action={createProduct} className="border rounded p-4 space-y-2">
        <h2 className="font-medium">Add product</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            name="name"
            placeholder="Name"
            className="border rounded px-2 py-1"
            required
          />
          <input
            name="priceCents"
            placeholder="Price (cents)"
            type="number"
            className="border rounded px-2 py-1"
            required
          />
          <select
            name="type"
            className="border rounded px-2 py-1"
            defaultValue="CANDLE"
          >
            <option value="CANDLE">Candle</option>
          </select>
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs text-gray-600">
              Image (Cloudflare Images or URL)
            </label>
            <CFImageField name="image" />
          </div>
          <textarea
            name="description"
            placeholder="Description"
            className="border rounded px-2 py-1 sm:col-span-2"
          />
          <fieldset className="sm:col-span-2 border rounded p-2">
            <legend className="text-xs text-gray-600 px-1">
              Scents (checked = included, in the order selected)
            </legend>
            {scentOptions.length === 0 ? (
              <p className="text-xs text-gray-600">
                No scents yet — add them on the{" "}
                <a href="/admin/scents" className="underline">
                  Scents
                </a>{" "}
                page first.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-40 overflow-y-auto">
                {scentOptions.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <input type="checkbox" name="scentIds" value={s.id} />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </div>
        <button className="rounded bg-black text-white px-3 py-1.5">
          Create
        </button>
      </form>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Name</th>
            <th>Price</th>
            <th>Scents</th>
            <th>Active</th>
            <th>Inventory</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2">{p.name}</td>
              <td>${(p.priceCents / 100).toFixed(2)}</td>
              <td className="text-gray-600">
                {p.scents.map((ps) => ps.scent.name).join(", ") || "—"}
              </td>
              <td>{p.active ? "Yes" : "No"}</td>
              <td>{p.inventory?.quantity ?? 0}</td>
              <td className="text-right">
                <form action={toggleActive} className="inline">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="underline mr-3">
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <form action={deleteProduct} className="inline">
                  <input type="hidden" name="id" value={p.id} />
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

async function createProduct(formData: FormData) {
  "use server";
  await requireCapability("manageProducts");
  const name = String(formData.get("name") || "").trim();
  const priceCents = Number(formData.get("priceCents"));
  const type = String(formData.get("type") || "CANDLE").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const image = String(formData.get("image") || "").trim() || null;
  // Selected scent ids, in checkbox (DOM) order → drives the note `position`.
  const scentIds = [
    ...new Set(formData.getAll("scentIds").map(String).filter(Boolean)),
  ];

  if (!name || !Number.isFinite(priceCents)) return;
  await prisma.product.create({
    data: {
      name,
      priceCents,
      type: type as ProductType,
      description,
      image,
      inventory: { create: { quantity: 0 } },
      scents: {
        create: scentIds.map((scentId, position) => ({ scentId, position })),
      },
    },
  });
}

async function toggleActive(formData: FormData) {
  "use server";
  await requireCapability("manageProducts");
  const id = String(formData.get("id"));
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return;
  await prisma.product.update({ where: { id }, data: { active: !p.active } });
}

async function deleteProduct(formData: FormData) {
  "use server";
  await requireCapability("manageProducts");
  const id = String(formData.get("id"));
  await prisma.product.delete({ where: { id } }).catch(() => {});
}
