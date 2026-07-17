import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
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
  const name = String(body?.name || "").trim() || null;
  if (!email || !password)
    return NextResponse.json(
      { error: "email and password required" },
      { status: 400 },
    );

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return NextResponse.json(
      { error: "email already registered" },
      { status: 409 },
    );

  const passwordHash = hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: "CUSTOMER" },
  });

  // Optionally link/create customer record on signup
  const customer = await prisma.customer.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { customerId: customer.id },
  });

  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt },
  });
  const token = signJwt({ sub: user.id, email: user.email, jti: session.id });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
