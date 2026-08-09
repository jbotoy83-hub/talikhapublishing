import { after, NextResponse } from "next/server";
import { apiErrorResponse, isApiError, requireAdminApi } from "@/lib/admin-api";
import { renewGmailWatch, runGmailBackfillBatch } from "@/lib/email/inbox";
import { gmailAccountEmail } from "@/lib/email/gmail";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  const user = await requireAdminApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  try {
    await renewGmailWatch(admin);
    after(async () => { await runGmailBackfillBatch(admin); });
    await admin.from("audit_events").insert({ actor_id: user.id, action: "gmail_sync_started", entity_type: "gmail_account", entity_id: "talikhapublishing@gmail.com", details: {} });
    return NextResponse.json({ ok: true, status: "importing" }, { status: 202 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not start Gmail synchronization.";
    await admin.from("gmail_sync_state").upsert({ account_email: gmailAccountEmail(), phase: /invalid_grant|expired|revoked/i.test(detail) ? "oauth_expired" : "error", last_error: detail }, { onConflict: "account_email" });
    await admin.from("audit_events").insert({ actor_id: user.id, action: /invalid_grant|expired|revoked/i.test(detail) ? "gmail_oauth_failure" : "gmail_sync_failure", entity_type: "gmail_account", entity_id: gmailAccountEmail(), details: { error: detail } });
    return apiErrorResponse(error, "Could not start Gmail synchronization.");
  }
}
