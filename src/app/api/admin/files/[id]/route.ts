import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  const { id } = await params; const { data: file } = await admin.from("submission_files").select("storage_path, storage_bucket, mime_type, original_name").eq("id", id).maybeSingle();
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const bucket = file.storage_bucket || "submission-files";
  if (!["submission-files", "submission-proofs", "receipts", "certificates"].includes(bucket)) return NextResponse.json({ error: "Invalid storage location" }, { status: 400 });
  const stream = new URL(request.url).searchParams.get("stream") === "1";
  const download = new URL(request.url).searchParams.get("download") === "1";
  await admin.from("audit_events").insert({ actor_id: user.id, action: "submission_file.opened", entity_type: "submission_file", entity_id: id, details: { stream } });
  if (stream) {
    const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(file.storage_path);
    if (dlErr || !blob) return NextResponse.json({ error: "Could not read file" }, { status: 500 });
    const headers = new Headers();
    headers.set("Content-Type", file.mime_type || blob.type || "application/octet-stream");
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${String(file.original_name || "file").replace(/"/g, "")}"`);
    return new Response(blob, { headers });
  }
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(file.storage_path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Could not authorize file access" }, { status: 500 });
  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
