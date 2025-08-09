import crypto from "node:crypto";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

type JwtPayload = { sub: string; email: string; iat: number; exp: number };

export function hashPassword(password: string) {
  return crypto.pbkdf2Sync(password, JWT_SECRET, 100_000, 32, "sha256").toString("hex");
}

export function verifyPassword(password: string, hash: string) {
  const h = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function signJwt(payload: Omit<JwtPayload, "iat" | "exp">, ttlSeconds = 60 * 60 * 24 * 7) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(full));
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${data}.${sig}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sig] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString()) as JwtPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set("session", token, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set("session", "", { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 0 });
}
