export const metadata = { title: "Log in" };

export default function LoginPage() {
  async function handleLogin(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    await fetch(`${process.env.SITE_URL || ""}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>
      <form action={handleLogin} className="space-y-3">
        <input name="email" type="email" placeholder="Email" className="w-full border rounded px-3 py-2" required />
        <input name="password" type="password" placeholder="Password" className="w-full border rounded px-3 py-2" required />
        <button className="w-full rounded bg-black text-white px-3 py-2">Log in</button>
      </form>
      <p className="mt-4 text-sm">Don’t have an account? <a href="/signup" className="underline">Sign up</a></p>
    </div>
  );
}
