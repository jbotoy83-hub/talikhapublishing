import { NextResponse } from "next/server";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const ONLINE_WINDOW_SECONDS = 90;
const AWAY_WINDOW_SECONDS = 10 * 60;

export async function GET() {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Team presence is unavailable." }, { status: 503 });

  const profiles = await admin
    .from("profiles")
    .select("id, email, username, display_name, role, headline, avatar_url, last_opened_at")
    .in("role", ["admin", "editor"])
    .order("display_name", { ascending: true });

  if (profiles.error) return NextResponse.json({ error: "Team presence is unavailable." }, { status: 503 });

  const now = Date.now();
  const members = (profiles.data || []).map((profile) => {
    const lastSeenAt = typeof profile.last_opened_at === "string" ? profile.last_opened_at : null;
    const lastSeenMs = lastSeenAt ? Date.parse(lastSeenAt) : Number.NaN;
    const elapsedSeconds = Number.isFinite(lastSeenMs) ? Math.max(0, (now - lastSeenMs) / 1000) : Number.POSITIVE_INFINITY;
    const status = elapsedSeconds <= ONLINE_WINDOW_SECONDS
      ? "online"
      : elapsedSeconds <= AWAY_WINDOW_SECONDS
        ? "away"
        : "offline";
    const email = typeof profile.email === "string" ? profile.email : "";
    const username = typeof profile.username === "string" ? profile.username : "";
    const displayName = typeof profile.display_name === "string" ? profile.display_name.trim() : "";
    const name = displayName || username || email.split("@")[0] || "Team member";
    return {
      id: String(profile.id),
      name,
      username: username || null,
      email,
      role: profile.role === "admin" ? "admin" : "editor",
      headline: typeof profile.headline === "string" ? profile.headline.trim() : "",
      avatarUrl: typeof profile.avatar_url === "string" && profile.avatar_url.trim() ? profile.avatar_url : null,
      status,
      lastSeenAt,
    };
  });

  return NextResponse.json(
    {
      generatedAt: new Date(now).toISOString(),
      heartbeatWindowSeconds: ONLINE_WINDOW_SECONDS,
      awayWindowSeconds: AWAY_WINDOW_SECONDS,
      members,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
