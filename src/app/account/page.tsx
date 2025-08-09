export const metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-4">
      <h1 className="text-3xl font-semibold">Your account</h1>
      <p>Account details will appear here.</p>
      <form action="/api/auth/logout" method="post">
        <button className="rounded bg-black text-white px-4 py-2">Logout</button>
      </form>
    </div>
  );
}
