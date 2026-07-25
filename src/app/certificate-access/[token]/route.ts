import { NextResponse } from "next/server";
import { hashCertificateToken } from "@/lib/certificate-security";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const admin = getSupabaseAdmin();
  if (!admin || !/^[A-Za-z0-9_-]{30,80}$/.test(token)) return new NextResponse("Not found", { status: 404 });
  const { data: link } = await admin.from("certificate_access_links").select("id,expires_at,revoked_at,output:certificate_output_versions(pdf_path)").eq("token_hash", hashCertificateToken(token)).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) return new NextResponse("This certificate link is unavailable.", { status: 410 });
  const output = Array.isArray(link.output) ? link.output[0] : link.output;
  if (!output?.pdf_path) return new NextResponse("Certificate output is unavailable.", { status: 404 });
  const { data, error } = await admin.storage.from("certificate-assets").download(output.pdf_path);
  if (error || !data) return new NextResponse("Certificate output is unavailable.", { status: 404 });
  return new NextResponse(await data.arrayBuffer(), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=talikha-certificate.pdf", "Cache-Control": "private, no-store" } });
}
