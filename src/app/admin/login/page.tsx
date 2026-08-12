import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { Brand } from "@/components/brand";
import { LoginDotField } from "@/components/login-dot-field";
import { TalikhaBoardTour } from "@/components/talikha-board-tour";
import { getAdminUser } from "@/lib/auth";
import { hasAdminSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false, noarchive: true } };

export default async function AdminLoginPage() {
  if (await getAdminUser()) redirect("/admin/welcome");
  const configured = hasAdminSupabaseConfig();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const loginWallpaper = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/editorial-media/site-assets/talikha-login-grain.png` : "/admin/assets/talikha-login-grain.png";

  return <main id="main-content" className="admin-login-shell grid h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#1c1c1c] text-white lg:grid-cols-[.92fr_1.08fr]">
    <section className="admin-login-primary relative flex h-full min-h-0 items-center overflow-hidden px-6 py-8 sm:px-12 lg:px-16 xl:px-20">
      <LoginDotField/>
      <div data-login-panel className="admin-login-panel relative z-10 mx-auto w-full max-w-[430px] rounded-2xl border border-white/[.06] bg-[#242424] p-8 shadow-[0_12px_32px_rgba(0,0,0,.18)] sm:p-10">
        <Brand inverse staticLogo/>
        <p className="admin-login-eyebrow mt-16 text-xs font-bold uppercase tracking-[.18em] text-clay-500">Protected workspace</p>
        <h1 className="admin-login-title mt-3 text-4xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Editorial Board</h1>
        <p className="admin-login-copy mt-4 max-w-sm text-base leading-7 text-white/55">Sign in with your Talikha Publishing team credentials to access the editorial workspace.</p>
        {configured ? <AdminLoginForm/> : <div className="mt-8 rounded-xl border border-amber-400/35 bg-[#18130d] p-4 text-sm leading-6 text-amber-100">Supabase environment variables are not connected. Public visitors cannot enter the admin workspace.</div>}
      </div>
    </section>
    <aside aria-label="Talikha Publishing" className="admin-login-aside relative hidden h-full min-h-0 overflow-hidden bg-[#1c1c1c] xl:flex xl:flex-col">
      <Image src={loginWallpaper} alt="" fill priority sizes="54vw" className="object-cover object-center"/>
      <div className="absolute inset-0 bg-black/10"/>
      <div className="admin-login-aside-heading relative z-10 px-14 pt-[clamp(2rem,10vh,6rem)] xl:px-20"><p className="max-w-xl text-5xl font-semibold leading-[.98] tracking-[-.055em] text-white xl:text-7xl">Advancing Knowledge.<br/>Honoring Expression.</p></div>
      <div className="admin-login-aside-tour relative z-10 mt-[clamp(1.5rem,8vh,8rem)] px-14 pb-[clamp(1rem,4vh,3rem)] xl:px-20"><TalikhaBoardTour/></div>
    </aside>
  </main>;
}
