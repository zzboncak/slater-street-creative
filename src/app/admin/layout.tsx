import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/auth";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Check session cookie
  const jar = await cookies();
  const token = jar.get("session")?.value;
  if (!token) redirect("/login?next=/admin");
  const payload = verifyJwt(token);
  if (!payload) redirect("/login?next=/admin");
  // Ensure user is admin
  if (!process.env.DATABASE_URL) redirect("/login?next=/admin");
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (!user || user.role !== "ADMIN") redirect("/login?next=/admin");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Admin</h1>
      <nav className="mb-6 flex gap-4 text-sm underline">
        <a href="/admin">Dashboard</a>
        <a href="/admin/products">Products</a>
        <a href="/admin/inventory">Inventory</a>
        <a href="/admin/coupons">Coupons</a>
      </nav>
      {children}
    </div>
  );
}
