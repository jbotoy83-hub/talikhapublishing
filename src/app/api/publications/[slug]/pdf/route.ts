import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Document access is unavailable." }, { status: 503 });
  const { slug } = await params;
  const embed = new URL(request.url).searchParams.has("embed");
  const { data: publication } = await admin.from("publications").select("id, status").eq("slug", slug).maybeSingle();
  if (!publication || publication.status !== "published") return NextResponse.json({ error: "Publication not found." }, { status: 404 });

  const { data: record } = await admin.from("publication_records").select("final_pdf_file_id").eq("publication_id", publication.id).maybeSingle();
  if (!record?.final_pdf_file_id) return NextResponse.json({ error: "Final PDF is not available." }, { status: 404 });
  const { data: file } = await admin.from("submission_files").select("storage_bucket, storage_path, mime_type").eq("id", record.final_pdf_file_id).maybeSingle();
  if (!file || file.mime_type !== "application/pdf") return NextResponse.json({ error: "Final PDF is not available." }, { status: 404 });

  const bucket = file.storage_bucket || "submission-files";
  if (!["submission-files", "submission-proofs", "receipts", "certificates"].includes(bucket)) return NextResponse.json({ error: "Document access is unavailable." }, { status: 500 });
  const { data: signed, error } = await admin.storage.from(bucket).createSignedUrl(file.storage_path, 60, { download: false });
  if (error || !signed?.signedUrl) return NextResponse.json({ error: "Document access is unavailable." }, { status: 500 });

  if (embed) {
    const upstream = await fetch(signed.signedUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "Document access is unavailable." }, { status: 502 });
    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", "inline");
    headers.set("Cache-Control", "private, max-age=60");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    return new Response(upstream.body, { status: 200, headers });
  }

  await admin.rpc("increment_publication_metric", { p_publication_id: publication.id, p_field: "downloads" });
  const response = NextResponse.redirect(signed.signedUrl, 302);
  response.headers.set("Cache-Control", "public, max-age=30, s-maxage=30");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}
