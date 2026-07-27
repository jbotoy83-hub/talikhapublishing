import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { publishDuePublications, synchronizeJournalLifecycles } from "@/lib/journal-lifecycle";

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
    const result = await synchronizeJournalLifecycles(admin);
    const scheduled = await publishDuePublications(admin);
    return NextResponse.json({ ok: true, ...result, ...scheduled, syncedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not synchronize journal lifecycles." }, { status: 500 });
  }
}
