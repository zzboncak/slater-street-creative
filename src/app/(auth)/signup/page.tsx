export const metadata = { title: "Sign up", robots: { index: false, follow: false } };

export default function SignupPage() {
  async function handleSignup(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const name = String(formData.get("name") || "");
    await fetch(`${process.env.SITE_URL || ""}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">Create your account</h1>
      <form action={handleSignup} className="space-y-3">
        <input name="name" placeholder="Full name" className="w-full border rounded px-3 py-2" />
        <input name="email" type="email" placeholder="Email" className="w-full border rounded px-3 py-2" required />
        <input name="password" type="password" placeholder="Password" className="w-full border rounded px-3 py-2" required />
        <button className="w-full rounded bg-black text-white px-3 py-2">Sign up</button>
      </form>
      <p className="mt-4 text-sm">Already have an account? <a href="/login" className="underline">Log in</a></p>
    </div>
  );
}
