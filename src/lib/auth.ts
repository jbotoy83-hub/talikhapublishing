import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "editor" | "viewer";
  username?: string | null;
  accessViews?: string[];
  requiresAccountSetup?: boolean;
  headline?: string;
  bio?: string;
  location?: string;
  website?: string;
  pronouns?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  createdAt?: string;
  lastSignedInAt?: string | null;
};

/**
 * Local-only escape hatch for working on the admin UI before Supabase admin
 * credentials are provisioned. Enabled ONLY when LOCAL_ADMIN_BYPASS=true is set
 * explicitly (and never in production). Staging/preview environments fail closed
 * unless they opt in, so a missing service-role key no longer grants admin access.
 */
function isLocalAdminBypassEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.LOCAL_ADMIN_BYPASS === "true";
}

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase())
      .filter(Boolean)
  );
}

export async function getAdminUser(): Promise<AdminUser | null> {
  if (isLocalAdminBypassEnabled()) {
    return {
      id: "local-development-admin",
      email: "local-admin@talikha.test",
      displayName: "Local development admin",
      role: "admin"
    };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";
  if (error || !userId || !email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, username, access_views, requires_account_setup, headline, bio, location, website, pronouns, avatar_url, cover_url, created_at, last_signed_in_at")
    .eq("id", userId)
    .maybeSingle();

  const configured = configuredAdminEmails().has(email.toLocaleLowerCase());
  const role = profile?.role;
  if (role !== "admin" && role !== "editor" && role !== "viewer" && !configured) return null;

  if (configured && role !== "admin") {
    const { error } = await admin.from("profiles").upsert({
      id: userId,
      email,
      display_name: profile?.display_name || email.split("@")[0],
      role: "admin"
    });
    if (error) return null;
  }

  const effectiveRole = configured ? "admin" : role;
  return {
    id: userId,
    email,
    displayName: profile?.display_name || email.split("@")[0],
    role: effectiveRole,
    username: profile?.username,
    accessViews: Array.isArray(profile?.access_views) ? profile.access_views.filter((view): view is string => typeof view === "string") : [],
    requiresAccountSetup: Boolean(profile?.requires_account_setup),
    headline: profile?.headline || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    website: profile?.website || "",
    pronouns: profile?.pronouns || "",
    avatarUrl: profile?.avatar_url || null,
    coverUrl: profile?.cover_url || null,
    createdAt: profile?.created_at,
    lastSignedInAt: profile?.last_signed_in_at || null
  };
}

export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user || user.role === "viewer") redirect("/admin/login");
  return user;
}
