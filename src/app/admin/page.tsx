import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="space-y-4">
      <p>Welcome to the admin dashboard. Choose a section:</p>
      <ul className="list-disc ml-6">
        <li><Link href="/admin/products" className="underline">Manage products</Link></li>
        <li><Link href="/admin/inventory" className="underline">Manage inventory</Link></li>
        <li><Link href="/admin/coupons" className="underline">Manage coupons</Link></li>
      </ul>
    </div>
  );
}
