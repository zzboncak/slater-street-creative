export const dynamic = "force-dynamic";

type ProductWithInventory = {
  id: string;
  name: string;
  inventory: { quantity: number } | null;
};

export default async function AdminInventoryPage() {
  let products: ProductWithInventory[] = [];
  if (process.env.DATABASE_URL) {
    const { prisma } = await import("@/lib/prisma");
    products = (await prisma.product.findMany({
      include: { inventory: true },
      orderBy: { name: "asc" },
    })) as unknown as ProductWithInventory[];
  }
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">Adjust inventory</h2>
      <ul className="space-y-2">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <span className="w-56 truncate">{p.name}</span>
            <form action={updateInventory} className="flex items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <input
                name="quantity"
                defaultValue={p.inventory?.quantity ?? 0}
                type="number"
                className="w-24 border rounded px-2 py-1"
              />
              <button className="rounded bg-black text-white px-3 py-1.5">
                Save
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function updateInventory(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const quantity = Number(formData.get("quantity"));
  if (!Number.isFinite(quantity)) return;
  if (!process.env.DATABASE_URL) return;
  const { prisma } = await import("@/lib/prisma");
  await prisma.inventory.upsert({
    where: { productId: id },
    update: { quantity },
    create: { productId: id, quantity },
  });
}
