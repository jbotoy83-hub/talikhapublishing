import { NextResponse } from "next/server";
import { isApiError, requireAdminApi } from "@/lib/admin-api";
import { fetchRemoteEmailImage } from "@/lib/email/remote-image";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireAdminApi();
  if (isApiError(user)) return user;
  const source = new URL(request.url).searchParams.get("url") || "";
  try {
    const image = await fetchRemoteEmailImage(source);
    return new NextResponse(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "This email image could not be loaded." }, { status: 422, headers: { "Cache-Control": "private, no-store" } });
  }
}
