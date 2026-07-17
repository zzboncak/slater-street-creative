import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  // getSessionUser does the full check (JWT signature/expiry → DB-backed session
  // validity → the User row). `role` therefore comes from the DB, never the JWT
  // payload — so a promotion or demotion takes effect on the next request, and a
  // stale token can't keep asserting an old role.
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ authenticated: false }, { status: 200 });
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email, role: user.role },
  });
}
