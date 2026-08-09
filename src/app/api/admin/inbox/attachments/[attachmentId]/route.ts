import { NextResponse } from "next/server";
import { apiErrorResponse, isApiError, requireAdminApi } from "@/lib/admin-api";
import { getGmailAttachment } from "@/lib/email/inbox";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const user = await requireAdminApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  try {
    const attachment = await getGmailAttachment(admin, (await params).attachmentId, user.id);
    return new NextResponse(attachment.bytes, { headers: { "Content-Type": attachment.mime_type, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return apiErrorResponse(error, "Could not download the attachment.");
  }
}
