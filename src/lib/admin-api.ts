import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, type AdminUser } from "@/lib/auth";

export async function requireEditorApi(): Promise<AdminUser | NextResponse> {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "editor") {
    return NextResponse.json({ error: "You do not have permission to make editorial changes." }, { status: 403 });
  }
  return user;
}

export function isApiError(value: AdminUser | Record<string, unknown> | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    return body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

export function apiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    const path = first?.path?.length ? `${first.path.join(".")}: ` : "";
    const message = first ? `${path}${first.message}` : "The request was invalid.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const message = error instanceof Error && error.message ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}
