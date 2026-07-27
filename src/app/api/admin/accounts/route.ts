import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isTeamUsername, normalizeTeamUsername, teamLoginEmail, validTeamViews } from "@/lib/team-accounts";

async function administrator() {
  const user = await getAdminUser();
  const admin = getSupabaseAdmin();
  return user?.role === "admin" && admin ? { user, admin } : null;
}

export async function GET() {
  const session = await administrator();
  if (!session) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  const [accounts, activity] = await Promise.all([
    session.admin.from("profiles").select("id, username, display_name, role, access_views, requires_account_setup, terms_accepted_at, last_signed_in_at, last_opened_at, created_at").in("role", ["admin", "editor"]).order("created_at", { ascending: false }),
    session.admin.from("audit_events").select("id, actor_id, action, entity_type, entity_id, details, created_at").eq("entity_type", "admin_account").order("created_at", { ascending: false }).limit(100)
  ]);
  if (accounts.error || activity.error) return NextResponse.json({ error: "Account records are unavailable." }, { status: 503 });
  return NextResponse.json({ accounts: accounts.data || [], activity: activity.data || [] });
}

export async function POST(request: Request) {
  const session = await administrator();
  if (!session) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const username = normalizeTeamUsername(typeof body.username === "string" ? body.username : "");
  const temporaryPassword = typeof body.temporaryPassword === "string" ? body.temporaryPassword : "";
  const accessViews = validTeamViews(body.accessViews);
  if (!isTeamUsername(username) || temporaryPassword.length < 10 || accessViews.length === 0) return NextResponse.json({ error: "Use a 3–32 character username, a 10+ character temporary password, and select at least one workspace." }, { status: 400 });
  const created = await session.admin.auth.admin.createUser({ email: teamLoginEmail(username), password: temporaryPassword, email_confirm: true, user_metadata: { display_name: "" } });
  if (created.error || !created.data.user) return NextResponse.json({ error: "That username is already in use or the account could not be created." }, { status: 400 });
  const update = await session.admin.from("profiles").update({ username, display_name: "", role: "editor", access_views: accessViews, requires_account_setup: true }).eq("id", created.data.user.id);
  if (update.error) return NextResponse.json({ error: "The sign-in account was created, but its access profile could not be saved." }, { status: 503 });
  await session.admin.from("audit_events").insert({ actor_id: session.user.id, action: "admin_team_account_created", entity_type: "admin_account", entity_id: created.data.user.id, details: { username, access_views: accessViews } });
  return NextResponse.json({ account: { id: created.data.user.id, username, accessViews } }, { status: 201 });
}
