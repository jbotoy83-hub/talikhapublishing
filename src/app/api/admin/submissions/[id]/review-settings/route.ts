import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";

const reviewSettingsInput = z.object({
  receipt: z.object({
    feeLabel: z.string().trim().max(120).default("Research processing fee"),
    fee: z.coerce.number().min(0).max(50000).default(0),
    tax: z.coerce.number().min(0).max(50000).default(0),
    discount: z.coerce.number().min(0).max(50000).default(0),
  }).default({ feeLabel: "Research processing fee", fee: 0, tax: 0, discount: 0 }),
  instructions: z.object({
    editorialGuidance: z.boolean().default(true),
    reviewerComments: z.boolean().default(true),
    revisionChecklist: z.boolean().default(false),
  }).default({ editorialGuidance: true, reviewerComments: true, revisionChecklist: false }),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });
  const { id } = await params;
  const { data, error } = await admin.from("submissions").select("review_settings").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "The review settings could not be loaded." }, { status: 503 });
  return NextResponse.json({ settings: data?.review_settings ?? null });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  const { id } = await params;
  try {
    const parsed = reviewSettingsInput.parse(body);
    const { error } = await admin.from("submissions").update({ review_settings: parsed }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "The review settings could not be saved.");
  }
}
