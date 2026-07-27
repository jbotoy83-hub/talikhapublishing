import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ActorProfile = { id: string; username: string | null; display_name: string | null; role: string | null };

export async function GET(request: Request) {
  const user = await getAdminUser();
  const admin = getSupabaseAdmin();
  if (!user || user.role !== "admin" || !admin) {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const entityType = params.get("entity_type");
  const limit = Math.min(Math.max(Number(params.get("limit")) || 200, 1), 500);

  let query = admin
    .from("audit_events")
    .select("id, actor_id, action, entity_type, entity_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (entityType) query = query.eq("entity_type", entityType);

  const { data: events, error } = await query;
  if (error) return NextResponse.json({ error: "The activity log is unavailable." }, { status: 503 });

  const rows = events || [];
  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))));
  const actors = new Map<string, ActorProfile>();
  if (actorIds.length) {
    const { data: profiles } = await admin.from("profiles").select("id, username, display_name, role").in("id", actorIds);
    for (const profile of (profiles || []) as ActorProfile[]) actors.set(profile.id, profile);
  }

  const enriched = rows.map((row) => {
    const actor = row.actor_id ? actors.get(row.actor_id) : undefined;
    return {
      ...row,
      actor_name: actor?.display_name || actor?.username || (row.actor_id ? "Unknown user" : "System"),
      actor_role: actor?.role || null,
    };
  });

  return NextResponse.json({ events: enriched });
}
