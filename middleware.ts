import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  const session = req.cookies.get("session")?.value;
  if (session) return NextResponse.next();
  const next = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
  const url = new URL(`/login?next=${next}`, req.url);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*"] };
