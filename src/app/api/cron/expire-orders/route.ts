import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireStalePendingOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

// PENDING orders older than this that never reached PAID are swept to EXPIRED.
const EXPIRE_AFTER_HOURS = 24;

// Constant-time string compare (matches the secret-comparison pattern in auth.ts).
function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Scheduled sweep of abandoned checkouts. Triggered by Vercel Cron (a GET), which
 * sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is configured. Not
 * feature-flag gated — cleanup runs regardless of whether commerce is enabled.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  // Fail closed: no secret configured → refuse rather than run unauthenticated.
  if (!secret || !auth || !timingSafeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await expireStalePendingOrders(prisma, EXPIRE_AFTER_HOURS);
  return NextResponse.json({ expired });
}
