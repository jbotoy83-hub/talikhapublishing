import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getAdminUser();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (displayName.length < 3 || password.length < 10 || body.acceptedTerms !== true) return NextResponse.json({ error: "Enter your full name, accept the policies, and use a password of at least 10 characters." }, { status: 400 });
  const authUpdate = await admin.auth.admin.updateUserById(user.id, { password, user_metadata: { display_name: displayName } });
  if (authUpdate.error) return NextResponse.json({ error: "Your password could not be updated." }, { status: 400 });
  const now = new Date().toISOString();
  await Promise.all([
    admin.from("profiles").update({ display_name: displayName, requires_account_setup: false, terms_accepted_at: now }).eq("id", user.id),
    admin.from("audit_events").insert({ actor_id: user.id, action: "admin_account_setup_completed", entity_type: "admin_account", entity_id: user.id, details: {} })
  ]);
  return NextResponse.json({ ok: true });
}
