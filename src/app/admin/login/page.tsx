import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { Brand } from "@/components/brand";
import { getAdminUser } from "@/lib/auth";
import { hasAdminSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false, noarchive: true } };

export default async function AdminLoginPage() {
  if (await getAdminUser()) redirect("/admin"); const configured = hasAdminSupabaseConfig();
  return <main id="main-content" className="grid min-h-screen place-items-center bg-forest-900 p-5"><section className="w-full max-w-md rounded-3xl bg-parchment p-8 shadow-2xl"><Brand/><p className="eyebrow mt-8">Protected workspace</p><h1 className="mt-2 font-serif text-3xl font-bold text-forest-900">Publisher admin</h1><p className="mt-3 text-sm leading-7 text-gray-600">Only authenticated accounts listed in <code>ADMIN_EMAILS</code> or assigned an editor role can enter.</p>{configured ? <AdminLoginForm/> : <div className="mt-7 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Supabase environment variables are not connected. Public visitors cannot enter the admin workspace.</div>}</section></main>;
}
