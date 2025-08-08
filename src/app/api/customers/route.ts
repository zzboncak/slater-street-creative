import { NextResponse } from "next/server";

// Simple in-memory stub for a customer management endpoint.
// Replace with a database in the future (Prisma + Postgres suggested).

const customers: { id: string; email: string; name?: string }[] = [];

export async function GET() {
  return NextResponse.json({ customers });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const exists = customers.find((c) => c.email === body.email);
  if (exists) return NextResponse.json(exists);
  const created = { id: String(Date.now()), email: body.email, name: body.name };
  customers.push(created);
  return NextResponse.json(created, { status: 201 });
}
