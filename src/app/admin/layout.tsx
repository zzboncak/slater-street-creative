export const metadata = { title: "Admin" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
