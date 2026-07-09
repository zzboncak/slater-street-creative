import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// JWT_SECRET signs session tokens only (password hashing uses per-user salts).
// Required in production; a dev-only fallback is allowed with a loud warning.
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is not set. It is required in production to sign session tokens.",
    );
  }
  console.warn(
    "\x1b[33m[auth] JWT_SECRET is not set — using an insecure development fallback. Set JWT_SECRET before deploying.\x1b[0m",
  );
  return "dev-secret-change-me";
}

const JWT_SECRET = resolveJwtSecret();
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Password hashing: pbkdf2 with a per-user random salt, stored as `salt:hash`.
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";
const SALT_BYTES = 16;

type JwtPayload = {
  sub: string;
  email: string;
  jti: string;
  iat: number;
  exp: number;
};

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = String(stored).split(":");
  // Reject malformed or legacy (pre-salt) hashes rather than throwing.
  if (!salt || !hash) return false;
  const computed = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
  const computedBuf = Buffer.from(computed, "hex");
  const storedBuf = Buffer.from(hash, "hex");
  // timingSafeEqual throws on length mismatch; guard keeps it timing-safe.
  if (computedBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, storedBuf);
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

// Must never throw: a malformed/attacker-supplied cookie should read as
// "not authenticated" (null), not crash the request with a 500.
export function verifyJwt(token: string): JwtPayload | null {
  try {
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
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    // timingSafeEqual throws on length mismatch; check length first, then
    // compare in constant time for equal-length (i.e. real) signatures.
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64").toString(),
    ) as JwtPayload;
    if (
      typeof payload?.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
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

/**
 * Resolve the currently-authenticated user (any role) from the session cookie,
 * or null. Validates the JWT signature/expiry and the DB-backed session
 * (existence, ownership, not revoked/expired). Fails closed on anything wrong.
 */
export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get("session")?.value;
  const payload = token ? verifyJwt(token) : null;
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if (!user) return null;

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
      return null;
    }
  }

  return user;
}

type AuthorizeResult =
  { ok: true; user: User } | { ok: false; status: 401 | 403 };

/**
 * Full server-side admin authorization check. Returns a discriminated result
 * instead of throwing, so each caller decides how to react (redirect to login,
 * return JSON, etc.). Fails closed: any missing/invalid step yields `ok: false`.
 *
 * - 401 = no usable session (missing/invalid JWT, or the DB session is
 *   missing/revoked/expired/belongs to another user).
 * - 403 = valid session but the user is not an ADMIN.
 */
export async function authorizeAdmin(): Promise<AuthorizeResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401 };
  if (user.role !== "ADMIN") return { ok: false, status: 403 };
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

/**
 * Session gate for customer-facing pages: returns the authenticated user (any
 * role), or redirects to the login page — preserving where they were headed via
 * `next` — on any failure (never returns on the failure path). For route
 * handlers that need a JSON status, call `getSessionUser()` directly instead.
 */
export async function requireUser(nextPath: string): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}
