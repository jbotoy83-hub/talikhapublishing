import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getAdminUser();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = body.action === "admin_signed_in" ? "admin_signed_in" : "admin_app_opened";
  const now = new Date().toISOString();
  const profileUpdate = action === "admin_signed_in"
    ? { last_signed_in_at: now, last_opened_at: now }
    : { last_opened_at: now };
  await admin.from("profiles").update(profileUpdate).eq("id", user.id);
  if (action === "admin_signed_in") {
    await admin.from("audit_events").insert({ actor_id: user.id, action, entity_type: "admin_account", entity_id: user.id, details: { username: user.username || null } });
  }
  return NextResponse.json({ ok: true });
}
