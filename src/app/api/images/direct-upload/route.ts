import { NextResponse } from "next/server";
import { CF_IMAGES } from "@/lib/cloudflare-images";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  // Admin auth guard
  const jar = await cookies();
  const token = jar.get("session")?.value;
  const payload = token ? verifyJwt(token) : null;
  if (!payload || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (payload.jti) {
    const session = await prisma.session.findUnique({
      where: { id: payload.jti },
    });
    const now = new Date();
    if (
      !session ||
      session.userId !== user.id ||
      session.revokedAt ||
      session.expiresAt <= now
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!CF_IMAGES.accountId || !CF_IMAGES.token) {
    return NextResponse.json(
      { error: "Cloudflare Images not configured" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_IMAGES.accountId}/images/v2/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_IMAGES.token}`,
        },
      },
    );
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return NextResponse.json(
        { error: data?.errors || "Failed to create direct upload URL" },
        { status: 500 },
      );
    }
    return NextResponse.json({ uploadURL: data.result?.uploadURL });
  } catch {
    return NextResponse.json(
      { error: "Cloudflare API error" },
      { status: 500 },
    );
  }
}
