import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSubmissionsEnabled } from "@/lib/launch";

const inputSchema = z.object({
  submissionId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  paths: z.array(z.string().min(1).max(500)).max(50).default([]),
});

function isSubmissionPath(path: string, submissionId: string) {
  return path.startsWith(`${submissionId}/`) && !path.includes("..") && !path.startsWith("/");
}

export async function POST(request: Request) {
  if (!isSubmissionsEnabled()) return NextResponse.json({ abandoned: false });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ abandoned: false });
  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ abandoned: false }, { status: 400 });

  const { submissionId, idempotencyKey } = parsed.data;
  const submissionResult = await admin
    .from("submissions")
    .select("id,status,idempotency_key")
    .eq("id", submissionId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  const submission = submissionResult.data;
  if (submissionResult.error || !submission || submission.status !== "uploading") return NextResponse.json({ abandoned: false });

  const filesResult = await admin
    .from("submission_files")
    .select("storage_bucket,storage_path")
    .eq("submission_id", submissionId);
  const pathsByBucket = new Map<string, Set<string>>();
  const addPath = (bucket: string, path: string) => {
    if (!path || (bucket === "submission-files" && !isSubmissionPath(path, submissionId))) return;
    const paths = pathsByBucket.get(bucket) || new Set<string>();
    paths.add(path);
    pathsByBucket.set(bucket, paths);
  };
  for (const file of filesResult.data || []) addPath(String(file.storage_bucket || "submission-files"), String(file.storage_path || ""));
  for (const path of parsed.data.paths) if (isSubmissionPath(path, submissionId)) addPath("submission-files", path);

  const cleanupErrors: string[] = [];
  await Promise.all(Array.from(pathsByBucket.entries()).map(async ([bucket, paths]) => {
    const result = await admin.storage.from(bucket).remove(Array.from(paths));
    if (result.error) cleanupErrors.push(result.error.message);
  }));

  const deleted = await admin.from("submissions").delete().eq("id", submissionId).eq("status", "uploading");
  if (deleted.error) return NextResponse.json({ abandoned: false, error: deleted.error.message, cleanupErrors }, { status: 500 });
  return NextResponse.json({ abandoned: true, cleanupErrors });
}
