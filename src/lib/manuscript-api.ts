import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { ManuscriptServiceError } from "@/lib/manuscripts";

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Cross-site manuscript changes are not allowed.", code: "ORIGIN_MISMATCH" }, { status: 403 });
  return null;
}

export function manuscriptApiError(error: unknown, fallback: string) {
  if (error instanceof ManuscriptServiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return NextResponse.json({ error: issue ? `${issue.path.join(".") || "request"}: ${issue.message}` : "Invalid manuscript request.", code: "VALIDATION_ERROR" }, { status: 400 });
  }
  return NextResponse.json({ error: error instanceof Error && error.message ? error.message : fallback, code: "MANUSCRIPT_ERROR" }, { status: 500 });
}

export async function readSizedJson(request: Request, maxBytes = 12 * 1024 * 1024) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new ManuscriptServiceError("The manuscript request is too large.", 413, "REQUEST_LIMIT");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new ManuscriptServiceError("The manuscript request is too large.", 413, "REQUEST_LIMIT");
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new ManuscriptServiceError("The manuscript request body is invalid JSON.", 400, "INVALID_JSON");
  }
}
