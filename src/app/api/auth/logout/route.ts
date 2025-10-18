import { NextResponse } from "next/server";
import { clearSessionCookie, verifyJwt } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  // Revoke DB session if we can identify it
  const jar = await cookies();
  const token = jar.get("session")?.value;
  if (token && process.env.DATABASE_URL) {
    const payload = verifyJwt(token);
    if (payload?.jti) {
      const { prisma } = await import("@/lib/prisma");
      await prisma.session.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
