import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signJwt, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").toLowerCase().trim();
  const password = String(body?.password || "");
  const name = String(body?.name || "").trim() || null;
  if (!email || !password) return NextResponse.json({ error: "email and password required" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "email already registered" }, { status: 409 });

  const passwordHash = hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash } });

  // Optionally link/create customer record on signup
  const customer = await prisma.customer.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });
  await prisma.user.update({ where: { id: user.id }, data: { customerId: customer.id } });

  const token = signJwt({ sub: user.id, email: user.email });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
