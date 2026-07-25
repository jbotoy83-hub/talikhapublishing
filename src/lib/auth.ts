import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "editor" | "viewer";
};

/**
 * Local-only escape hatch for working on the admin UI before Supabase admin
 * credentials are provisioned. Automatically enabled when Supabase is not
 * connected, or when LOCAL_ADMIN_BYPASS=true is set explicitly.
 */
function isLocalAdminBypassEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.LOCAL_ADMIN_BYPASS === "true") return true;
  if (!getSupabaseAdmin()) return true;
  return false;
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
    .select("display_name, role")
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

  return {
    id: userId,
    email,
    displayName: profile?.display_name || email.split("@")[0],
    role: configured ? "admin" : role
  };
}

export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user || user.role === "viewer") redirect("/admin/login");
  return user;
}
