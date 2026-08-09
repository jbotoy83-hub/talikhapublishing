import { NextResponse } from "next/server";
import { deliverQueuedMessages, ensureSubmissionConfirmations } from "@/lib/email/correspondence";
import { gmailAccountEmail, gmailSyncEnabled } from "@/lib/email/gmail";
import { renewGmailWatch, replayGmailHistory, runGmailBackfillBatch } from "@/lib/email/inbox";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  try {
    const confirmationStart = process.env.EMAIL_CONFIRMATIONS_STARTED_AT?.trim();
    const { data: candidates } = confirmationStart
      ? await admin.from("submissions").select("id").eq("status", "submitted").gte("submitted_at", confirmationStart).limit(100)
      : { data: [] };
    let reconciled = 0;
    for (const submission of candidates || []) {
      await ensureSubmissionConfirmations(admin, submission.id);
      reconciled++;
    }
    const delivered = await deliverQueuedMessages(admin, undefined, 25);
    let sync: unknown = { enabled: false };
    if (gmailSyncEnabled()) {
      const { data: state } = await admin.from("gmail_sync_state").select("backfill_complete, watch_expiration, history_id").eq("account_email", gmailAccountEmail()).maybeSingle();
      if (!state?.watch_expiration || new Date(state.watch_expiration).getTime() < Date.now() + 2 * 86_400_000) await renewGmailWatch(admin);
      sync = state?.backfill_complete ? await replayGmailHistory(admin) : await runGmailBackfillBatch(admin, 50);
    }
    return NextResponse.json({ ok: true, reconciled, deliveries: delivered.length, sync, maintainedAt: new Date().toISOString() });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Email maintenance failed.";
    await admin.from("gmail_sync_state").update({ phase: /invalid_grant|expired|revoked/i.test(detail) ? "oauth_expired" : "error", last_error: detail }).eq("account_email", gmailAccountEmail());
    await admin.from("audit_events").insert({ action: /invalid_grant|expired|revoked/i.test(detail) ? "gmail_oauth_failure" : "email_maintenance_failure", entity_type: "gmail_account", entity_id: gmailAccountEmail(), details: { error: detail } });
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}
