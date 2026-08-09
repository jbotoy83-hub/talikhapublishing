import { after, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, readJsonBody, requireAdminApi } from "@/lib/admin-api";
import { createAdminMessage, deliverEmailMessage, resolveSubmissionRecipients } from "@/lib/email/correspondence";
import { gmailAccountEmail, gmailOutboundEnabled, gmailSyncEnabled } from "@/lib/email/gmail";
import { listInboxThreads } from "@/lib/email/inbox";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const sendSchema = z.object({
  idempotencyKey: z.uuid(),
  threadId: z.uuid().optional(),
  submissionId: z.uuid().optional(),
  recipientEmail: z.email().max(254).optional(),
  subject: z.string().trim().min(1).max(200).refine((value) => !/[\r\n]/.test(value), "Subject contains invalid characters."),
  body: z.string().trim().min(1).max(20_000).refine((value) => !/<\/?[a-z][\s\S]*>/i.test(value), "Write plain text only.")
});

export async function GET(request: Request) {
  const user = await requireAdminApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const params = new URL(request.url).searchParams;
  if (params.get("kind") === "submissions") {
    const search = params.get("q")?.trim().replace(/[%_,()]/g, "") || "";
    let query = admin.from("submissions").select("id, reference, title, author_name, author_email, author_details, journal_title_snapshot").eq("status", "submitted").order("submitted_at", { ascending: false }).limit(100);
    if (search) query = query.or(`reference.ilike.%${search}%,title.ilike.%${search}%,author_email.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Could not load submission recipients." }, { status: 500 });
    return NextResponse.json({ submissions: (data || []).map((submission) => ({ id: submission.id, reference: submission.reference, title: submission.title, journal: submission.journal_title_snapshot, recipients: resolveSubmissionRecipients(submission) })) });
  }
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(params.get("pageSize")) || 25));
  try {
    const result = await listInboxThreads(admin, { page, pageSize, filter: params.get("filter") || "inbox", query: (params.get("q") || "").trim().slice(0, 160) });
    const { data: sync } = await admin.from("gmail_sync_state").select("phase, backfill_complete, imported_threads, watch_expiration, last_synced_at, last_error").eq("account_email", gmailAccountEmail()).maybeSingle();
    return NextResponse.json({ ...result, page, pageSize, connection: { account: gmailAccountEmail(), outboundEnabled: gmailOutboundEnabled(), syncEnabled: gmailSyncEnabled(), sync: sync || null } });
  } catch (error) {
    return apiErrorResponse(error, "Could not load the Inbox.");
  }
}

export async function POST(request: Request) {
  const user = await requireAdminApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  try {
    const input = sendSchema.parse(body);
    const message = await createAdminMessage(admin, { ...input, actorId: user.id });
    after(async () => { await deliverEmailMessage(admin, message.id); });
    return NextResponse.json({ ok: true, message }, { status: 202 });
  } catch (error) {
    return apiErrorResponse(error, "Could not queue the email.");
  }
}
