export const dynamic = "force-dynamic";

type ProductWithInventory = {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
  inventory: { quantity: number } | null;
};

// Client-side uploader for Cloudflare Images
import CFImageField from "@/components/admin/ImageField";

export default async function AdminProductsPage() {
  let products: ProductWithInventory[] = [];
  if (process.env.DATABASE_URL) {
    const { prisma } = await import("@/lib/prisma");
    products = (await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { inventory: true },
    })) as unknown as ProductWithInventory[];
  }

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
          {/* Image: supports Cloudflare Images direct upload; stores returned id in hidden input */}
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
            <th>Active</th>
            <th>Inventory</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p: ProductWithInventory) => (
            <tr key={p.id} className="border-b">
              <td className="py-2">{p.name}</td>
              <td>
                ${""}
                {(p.priceCents / 100).toFixed(2)}
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
  const name = String(formData.get("name") || "").trim();
  const priceCents = Number(formData.get("priceCents"));
  const description = String(formData.get("description") || "").trim() || null;
  const image = String(formData.get("image") || "").trim() || null;
  if (!name || !Number.isFinite(priceCents)) return;
  if (!process.env.DATABASE_URL) return;
  const { prisma } = await import("@/lib/prisma");
  await prisma.product.create({
    data: {
      name,
      priceCents,
      description,
      image,
      inventory: { create: { quantity: 0 } },
    },
  });
}

async function toggleActive(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  if (!process.env.DATABASE_URL) return;
  const { prisma } = await import("@/lib/prisma");
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return;
  await prisma.product.update({ where: { id }, data: { active: !p.active } });
}

async function deleteProduct(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  if (!process.env.DATABASE_URL) return;
  const { prisma } = await import("@/lib/prisma");
  await prisma.product.delete({ where: { id } }).catch(() => {});
}
