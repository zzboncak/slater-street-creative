import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type JwtPayload = {
  sub: string;
  email: string;
  jti: string;
  iat: number;
  exp: number;
};

export function hashPassword(password: string) {
  return crypto
    .pbkdf2Sync(password, JWT_SECRET, 100_000, 32, "sha256")
    .toString("hex");
}

export function verifyPassword(password: string, hash: string) {
  const h = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp">,
  ttlSeconds = SESSION_TTL_SECONDS,
) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  } as JwtPayload;
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(full));
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${data}.${sig}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sig] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expected = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return null;
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64").toString(),
  ) as JwtPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set("session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

type AuthorizeResult =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 403 };

/**
 * Full server-side admin authorization check. Returns a discriminated result
 * instead of throwing, so each caller decides how to react (redirect to login,
 * return JSON, etc.). Fails closed: any missing/invalid step yields `ok: false`.
 *
 * - 401 = no usable session (missing/invalid JWT, or the DB session is
 *   missing/revoked/expired/belongs to another user, or the DB is unreachable).
 * - 403 = valid session but the user is not an ADMIN.
 */
export async function authorizeAdmin(): Promise<AuthorizeResult> {
  const jar = await cookies();
  const token = jar.get("session")?.value;
  const payload = token ? verifyJwt(token) : null;
  if (!payload || !process.env.DATABASE_URL) return { ok: false, status: 401 };

  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if (!user) return { ok: false, status: 401 };
  if (user.role !== "ADMIN") return { ok: false, status: 403 };

  // Session revocation is DB-backed by jti; reject anything not currently valid.
  if (payload.jti) {
    const session = await prisma.session.findUnique({
      where: { id: payload.jti },
    });
    if (
      !session ||
      session.userId !== user.id ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      return { ok: false, status: 401 };
    }
  }

  return { ok: true, user };
}

/**
 * Admin gate for server actions and the admin layout: returns the ADMIN user
 * on success, or redirects to the login page on any failure (never returns on
 * the failure path). For route handlers that need to return a specific JSON
 * status, call `authorizeAdmin()` directly instead.
 */
export async function requireAdmin(): Promise<User> {
  const result = await authorizeAdmin();
  if (!result.ok) redirect("/login?next=/admin");
  return result.user;
}
