import Link from "next/link";
import { requireAdminArea } from "@/lib/authz";

export const metadata = { title: "Admin" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Coarse gate: admit any admin-area role (ADMIN or FULFILLMENT); each page and
  // action below enforces its specific capability. Role-aware nav (hiding links a
  // FULFILLMENT user can't use) is the follow-up FE ticket, SSC-37.
  await requireAdminArea();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Admin</h1>
      <nav className="mb-6 flex gap-4 text-sm underline">
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/products">Products</Link>
        <Link href="/admin/scents">Scents</Link>
        <Link href="/admin/inventory">Inventory</Link>
        <Link href="/admin/coupons">Coupons</Link>
        <Link href="/admin/orders">Orders</Link>
      </nav>
      {children}
    </div>
  );
}
