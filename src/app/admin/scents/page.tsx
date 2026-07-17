import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { scentSlug } from "@/lib/scents";

export const dynamic = "force-dynamic";

type ScentRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  _count: { products: number };
};

export default async function AdminScentsPage() {
  // Scents are the product vocabulary, so they ride the manageProducts capability.
  await requireCapability("manageProducts");
  const scents = (await prisma.scent.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  })) as unknown as ScentRow[];

  return (
    <div className="space-y-6">
      <form action={createScent} className="border rounded p-4 space-y-2">
        <h2 className="font-medium">Add scent</h2>
        <div className="flex gap-2">
          <input
            name="name"
            placeholder="Scent name (e.g. Blue Spruce)"
            className="border rounded px-2 py-1 flex-1"
            required
          />
          <button className="rounded bg-black text-white px-3 py-1.5">
            Create
          </button>
        </div>
        <p className="text-xs text-gray-600">
          The unique key (slug) is generated from the name — duplicates by
          casing or spacing are rejected.
        </p>
      </form>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Name</th>
            <th>Slug</th>
            <th>Used by</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {scents.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="py-2">
                <form action={renameScent} className="inline-flex items-center">
                  <input type="hidden" name="id" value={s.id} />
                  <input
                    name="name"
                    defaultValue={s.name}
                    aria-label={`Rename ${s.name}`}
                    className="border rounded px-1.5 py-0.5 w-44"
                  />
                  <button className="underline ml-2 text-xs">Save</button>
                </form>
              </td>
              <td className="font-mono text-xs text-gray-600">{s.slug}</td>
              <td>{s._count.products}</td>
              <td>{s.active ? "Yes" : "No"}</td>
              <td className="text-right">
                <form action={toggleScentActive} className="inline">
                  <input type="hidden" name="id" value={s.id} />
                  <button className="underline mr-3">
                    {s.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
                {s._count.products === 0 ? (
                  <form action={deleteScent} className="inline">
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-red-600 underline">Delete</button>
                  </form>
                ) : (
                  <span
                    className="text-gray-400"
                    title="In use — deactivate instead"
                  >
                    Delete
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function createScent(formData: FormData) {
  "use server";
  await requireCapability("manageProducts");
  const name = String(formData.get("name") || "").trim();
  const slug = scentSlug(name);
  if (!name || !slug) return;
  // The unique slug rejects casing/whitespace duplicates; ignore that conflict.
  await prisma.scent.create({ data: { name, slug } }).catch(() => {});
}

async function renameScent(formData: FormData) {
  "use server";
  await requireCapability("manageProducts");
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  // Rename updates the display name only; the slug stays the stable identity key
  // (existing product links reference the scent by id, so they're unaffected).
  await prisma.scent.update({ where: { id }, data: { name } });
}

async function toggleScentActive(formData: FormData) {
  "use server";
  await requireCapability("manageProducts");
  const id = String(formData.get("id"));
  const s = await prisma.scent.findUnique({ where: { id } });
  if (!s) return;
  await prisma.scent.update({ where: { id }, data: { active: !s.active } });
}

async function deleteScent(formData: FormData) {
  "use server";
  await requireCapability("manageProducts");
  const id = String(formData.get("id"));
  // onDelete: Restrict means a scent still linked to products can't be deleted;
  // the UI only offers Delete when unused, and this catch is the backstop.
  await prisma.scent.delete({ where: { id } }).catch(() => {});
}
