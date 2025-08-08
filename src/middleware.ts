import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple Basic Auth for /admin (replace with proper auth later)
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  if (!ADMIN_USER || !ADMIN_PASS) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": "Basic realm=admin" },
    });
  }
  const [, encoded] = auth.split(" ");
  const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
  if (user === ADMIN_USER && pass === ADMIN_PASS) return NextResponse.next();
  return new NextResponse("Unauthorized", { status: 401 });
}

export const config = {
  matcher: ["/admin/:path*"],
};
