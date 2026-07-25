import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Shared JSON source of truth for journals + issues.
// The public site reads this file (src/lib/content.ts); the admin panel writes it
// through this route (proxied from the Vite admin in development). Editing here is
// what makes a change in the admin reflect on the public site.
const STORE_PATH = join(process.cwd(), "src", "data", "journal-store.json");

type StoreShape = { version?: number; journals: unknown[]; issues: unknown[] };

function readStore(): StoreShape | null {
  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as StoreShape;
    if (parsed && Array.isArray(parsed.journals) && Array.isArray(parsed.issues)) return parsed;
  } catch {
    /* missing or unreadable — caller decides the fallback */
  }
  return null;
}

function isStoreShape(value: unknown): value is StoreShape {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as StoreShape).journals) &&
    Array.isArray((value as StoreShape).issues)
  );
}

function writeIsAllowed(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const token = process.env.JOURNAL_STORE_TOKEN;
  if (!token) return false;
  return req.headers.get("x-journal-store-token") === token;
}

export async function GET() {
  const data = readStore();
  return NextResponse.json(data ?? { version: 1, journals: [], issues: [] });
}

export async function POST(req: Request) {
  if (!writeIsAllowed(req)) {
    return NextResponse.json({ error: "forbidden — set JOURNAL_STORE_TOKEN in production" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!isStoreShape(body)) {
    return NextResponse.json({ error: "body must be { journals: [], issues: [] }" }, { status: 400 });
  }

  const payload: StoreShape = {
    version: typeof body.version === "number" ? body.version : 1,
    journals: body.journals,
    issues: body.issues
  };

  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "could not write journal store", detail: message }, { status: 500 });
  }

  // Bust the cached public pages so the edit is visible without waiting on ISR.
  try {
    revalidatePath("/", "layout");
  } catch {
    /* revalidation is best-effort; in dev pages re-render on demand anyway */
  }

  return NextResponse.json({
    ok: true,
    journals: payload.journals.length,
    issues: payload.issues.length,
    syncedAt: new Date().toISOString()
  });
}
