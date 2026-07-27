import { NextResponse } from "next/server";
import { getPublicSupabase } from "@/lib/supabase/public";
import { isWithinWindow, toSettings, type AnnouncementRow } from "@/lib/announcements";

export async function GET() {
  const publicClient = getPublicSupabase();
  if (!publicClient) return NextResponse.json({ announcement: null });
  const { data, error } = await publicClient
    .from("announcements")
    .select("*")
    .eq("enabled", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ announcement: null });
  const row = data as AnnouncementRow;
  if (!isWithinWindow(row)) return NextResponse.json({ announcement: null });
  return NextResponse.json({ announcement: toSettings(row) });
}
