import { NextResponse } from "next/server";
import {
  verifyPassword,
  signJwt,
  setSessionCookie,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "")
    .toLowerCase()
    .trim();
  const password = String(body?.password || "");
  if (!email || !password)
    return NextResponse.json(
      { error: "email and password required" },
      { status: 400 },
    );

  if (!process.env.DATABASE_URL)
    return NextResponse.json(
      { error: "database not configured" },
      { status: 500 },
    );
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user)
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  if (!verifyPassword(password, user.passwordHash))
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });

  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt },
  });
  const token = signJwt({ sub: user.id, email: user.email, jti: session.id });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
