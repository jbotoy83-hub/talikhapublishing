import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const inputSchema = z.string().uuid();

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });

  try {
    const submissionId = inputSchema.parse((await params).id);
    const { data, error } = await admin.rpc("delete_submission_cascade", { p_submission_id: submissionId });
    if (error) throw error;

    const files = Array.isArray(data?.files) ? data.files as Array<{ bucket?: unknown; path?: unknown }> : [];
    const storageCleanupErrors: string[] = [];
    const byBucket = new Map<string, string[]>();
    for (const file of files) {
      const bucket = typeof file.bucket === "string" ? file.bucket : "";
      const path = typeof file.path === "string" ? file.path : "";
      if (!bucket || !path) continue;
      byBucket.set(bucket, [...(byBucket.get(bucket) || []), path]);
    }
    for (const [bucket, paths] of byBucket) {
      const result = await admin.storage.from(bucket).remove(paths);
      if (result.error) storageCleanupErrors.push(`${bucket}: ${result.error.message}`);
    }

    return NextResponse.json({ ok: true, storageCleanupErrors });
  } catch (error) {
    return apiErrorResponse(error, "The submission could not be deleted.");
  }
}
