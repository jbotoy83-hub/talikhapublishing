import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const response = NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
  if (!url || !anonKey) return response;
  const cookieHeader = request.headers.get("cookie") || "";
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieHeader.split(";").map((part) => part.trim()).filter(Boolean).map((part) => { const index = part.indexOf("="); return { name: part.slice(0, index), value: part.slice(index + 1) }; }),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    }
  });
  await supabase.auth.signOut();
  return response;
}
