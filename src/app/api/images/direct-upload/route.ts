import { NextResponse } from "next/server";
import { CF_IMAGES } from "@/lib/cloudflare-images";
import { authorizeCapability } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function POST() {
  // Capability guard — preserve the 401 (no session) / 403 (lacks capability) split.
  const auth = await authorizeCapability("manageImages");
  if (!auth.ok) {
    const error = auth.status === 403 ? "Forbidden" : "Unauthorized";
    return NextResponse.json({ error }, { status: auth.status });
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
