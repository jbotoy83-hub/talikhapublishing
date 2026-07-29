import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const response = NextResponse.next({ request });
  if (!url || !anonKey) return { response, user: null };

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { data } = await supabase.auth.getUser();
  return { response, user: data.user };
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (request.nextUrl.pathname.startsWith("/admin")) {
    const isLoginRoute = request.nextUrl.pathname === "/admin/login" || request.nextUrl.pathname === "/admin/welcome";
    if (!isLoginRoute && !user) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|admin/assets/|admin/manifest.webmanifest|admin/admin-icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|mjs|css|map|woff|woff2|ttf|otf)$).*)"]
};
