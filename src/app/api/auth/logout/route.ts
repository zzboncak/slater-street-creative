import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie, verifyJwt } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  // Revoke DB session if we can identify it
  const jar = await cookies();
  const token = jar.get("session")?.value;
  if (token) {
    const payload = verifyJwt(token);
    if (payload?.jti) {
      await prisma.session.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
