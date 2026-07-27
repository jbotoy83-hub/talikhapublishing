import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return new NextResponse(null, { status: 204 });
  const { slug } = await params;
  const { data: publication } = await admin.from("publications").select("id, status").eq("slug", slug).maybeSingle();
  if (!publication || publication.status !== "published") return new NextResponse(null, { status: 204 });
  await admin.rpc("increment_publication_metric", { p_publication_id: publication.id, p_field: "views" });
  return new NextResponse(null, { status: 204 });
}
