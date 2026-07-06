import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyJwt } from "@/lib/auth";

export async function GET() {
  const jar = await cookies();
  const token = jar.get("session")?.value || "";
  const payload = token ? verifyJwt(token) : null;
  if (!payload)
    return NextResponse.json({ authenticated: false }, { status: 200 });
  if (payload.jti) {
    const session = await prisma.session.findUnique({
      where: { id: payload.jti },
    });
    const now = new Date();
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= now
    ) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }
  }
  return NextResponse.json({
    authenticated: true,
    user: { id: payload.sub, email: payload.email },
  });
}
