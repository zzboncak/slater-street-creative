import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Fallback in-memory store if DATABASE_URL not set
const mem: { id: string; email: string; name?: string }[] = [];

function dbEnabled() {
  return !!process.env.DATABASE_URL;
}

export async function GET() {
  if (dbEnabled()) {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ customers });
  }
  return NextResponse.json({ customers: mem });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.email)
    return NextResponse.json({ error: "email required" }, { status: 400 });
  if (dbEnabled()) {
    const existing = await prisma.customer.findUnique({
      where: { email: body.email },
    });
    if (existing) return NextResponse.json(existing);
    const created = await prisma.customer.create({
      data: { email: body.email, name: body.name },
    });
    return NextResponse.json(created, { status: 201 });
  }
  const exists = mem.find((c) => c.email === body.email);
  if (exists) return NextResponse.json(exists);
  const created = {
    id: String(Date.now()),
    email: body.email,
    name: body.name,
  };
  mem.push(created);
  return NextResponse.json(created, { status: 201 });
}
