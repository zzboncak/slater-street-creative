import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signJwt, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").toLowerCase().trim();
  const password = String(body?.password || "");
  if (!email || !password) return NextResponse.json({ error: "email and password required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  if (!verifyPassword(password, user.passwordHash)) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });

  const token = signJwt({ sub: user.id, email: user.email });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
