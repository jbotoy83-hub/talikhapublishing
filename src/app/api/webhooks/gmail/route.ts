import { after, NextResponse } from "next/server";
import { z } from "zod";
import { gmailAccountEmail, gmailSyncEnabled } from "@/lib/email/gmail";
import { replayGmailHistory } from "@/lib/email/inbox";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const notificationSchema = z.object({ message: z.object({ messageId: z.string().min(1), data: z.string().min(1) }), subscription: z.string().optional() });

async function verifyGoogleToken(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const audience = process.env.GMAIL_PUBSUB_AUDIENCE?.trim();
  const allowedEmail = process.env.GMAIL_PUBSUB_SERVICE_ACCOUNT?.trim().toLowerCase();
  if (!token || !audience || !allowedEmail) return false;
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const claims = await response.json().catch(() => ({})) as { aud?: string; email?: string; email_verified?: string | boolean };
  return response.ok && claims.aud === audience && claims.email?.toLowerCase() === allowedEmail && (claims.email_verified === true || claims.email_verified === "true");
}

export async function POST(request: Request) {
  if (!gmailSyncEnabled()) return NextResponse.json({ error: "Gmail synchronization is disabled." }, { status: 503 });
  if (!await verifyGoogleToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = notificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification." }, { status: 400 });
  const decoded = JSON.parse(Buffer.from(parsed.data.message.data, "base64").toString("utf8")) as { emailAddress?: string; historyId?: string };
  if (decoded.emailAddress?.toLowerCase() !== gmailAccountEmail() || !decoded.historyId) return NextResponse.json({ error: "Notification account mismatch." }, { status: 400 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  after(async () => {
    try {
      await replayGmailHistory(admin);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Gmail history synchronization failed.";
      await admin.from("gmail_sync_state").update({ phase: /invalid_grant|expired|revoked/i.test(detail) ? "oauth_expired" : "error", last_error: detail }).eq("account_email", gmailAccountEmail());
      await admin.from("audit_events").insert({ action: /invalid_grant|expired|revoked/i.test(detail) ? "gmail_oauth_failure" : "gmail_sync_failure", entity_type: "gmail_account", entity_id: gmailAccountEmail(), details: { error: detail } });
    }
  });
  return NextResponse.json({ ok: true });
}
