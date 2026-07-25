"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export function AdminLoginForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const supabase = getSupabaseBrowser();
    if (!supabase) { setMessage("Supabase authentication is not configured."); setPending(false); return; }
    const data = new FormData(event.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({ email: String(data.get("email") || ""), password: String(data.get("password") || "") });
    if (error) { setMessage("Sign-in failed. Check your credentials and administrator access."); setPending(false); return; }
    window.location.href = process.env.NODE_ENV === "development" ? "http://localhost:5173/admin" : "/admin";
  }

  async function magicLink(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const email = String(new FormData(form).get("email") || "");
    const supabase = getSupabaseBrowser(); if (!supabase || !email) { setMessage("Enter your administrator email first."); return; }
    setPending(true); const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback?next=/admin` } });
    setMessage(error ? "The magic link could not be sent." : "Check your email for a secure sign-in link."); setPending(false);
  }

  return <form onSubmit={login} className="mt-8 space-y-5"><label className="block text-sm font-bold text-forest-900">Administrator email<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border border-forest-900/15 bg-white px-4 py-3 font-normal"/></label><label className="block text-sm font-bold text-forest-900">Password<input name="password" type="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-forest-900/15 bg-white px-4 py-3 font-normal"/></label>{message && <p className="rounded-xl bg-clay-50 p-3 text-sm text-clay-700" role="status">{message}</p>}<button disabled={pending} className="w-full rounded-xl bg-forest-800 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button><button type="button" onClick={magicLink} disabled={pending} className="w-full rounded-xl border border-forest-900/15 bg-white px-5 py-3.5 text-sm font-bold text-forest-900">Email me a magic link</button></form>;
}
