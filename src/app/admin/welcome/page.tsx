import { redirect } from "next/navigation";
import { AdminAccountSetupForm } from "@/components/admin-account-setup-form";
import { getAdminUser } from "@/lib/auth";

export default async function AdminWelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  const requested = (await searchParams).next || "/admin";
  const next = requested.startsWith("/admin") ? requested : "/admin";
  if (!user.requiresAccountSetup) redirect(next);
  return <main className="grid min-h-screen place-items-center bg-[#f7f8f7] p-5"><section className="w-full max-w-xl rounded-3xl border border-forest-900/10 bg-white p-8 shadow-xl sm:p-10"><p className="eyebrow">First sign-in</p><h1 className="mt-3 font-serif text-4xl font-bold text-forest-900">Make this account yours.</h1><p className="mt-4 text-base leading-7 text-gray-600">Your temporary account is ready. Complete this once before entering the editorial workspace.</p><AdminAccountSetupForm username={user.username || user.email} next={next}/></section></main>;
}
