export const metadata = { title: "Log in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  async function handleLogin(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").toLowerCase().trim();
    const password = String(formData.get("password") || "");
    if (!process.env.DATABASE_URL) {
      redirect("/login?error=db");
    }
    const { prisma } = await import("@/lib/prisma");
  const { verifyPassword, setSessionCookie, signJwt, SESSION_TTL_SECONDS } = await import("@/lib/auth");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      redirect("/login?error=invalid");
    }
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt } });
  const token = signJwt({ sub: user.id, email: user.email, jti: session.id });
  await setSessionCookie(token);
  const params = await searchParams;
  const next = params?.next || "/account";
  redirect(next);
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>
      <form action={handleLogin} className="space-y-3">
        <input name="email" type="text" placeholder="Email or username" className="w-full border rounded px-3 py-2" required />
        <input name="password" type="password" placeholder="Password" className="w-full border rounded px-3 py-2" required />
        <button className="w-full rounded bg-black text-white px-3 py-2">Log in</button>
      </form>
      <p className="mt-4 text-sm">Don’t have an account? <a href="/signup" className="underline">Sign up</a></p>
    </div>
  );
}
