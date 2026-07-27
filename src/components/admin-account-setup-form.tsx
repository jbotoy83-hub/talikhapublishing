"use client";
import { useState } from "react";

export function AdminAccountSetupForm({ username, next }: { username: string; next: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    if (password !== String(data.get("confirmPassword") || "")) { setMessage("The passwords do not match."); setPending(false); return; }
    const response = await fetch("/api/admin/account-setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: data.get("displayName"), password, acceptedTerms: data.get("acceptedTerms") === "on" }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(result.error || "Your account could not be updated."); setPending(false); return; }
    window.location.assign(next);
  }
  return <form onSubmit={submit} className="mt-8 space-y-5"><p className="rounded-xl bg-forest-50 p-4 text-sm leading-6 text-forest-900">You are signing in as <strong>{username}</strong>. Choose the name your team will see and replace the temporary password before continuing.</p><label className="block text-sm font-bold text-forest-900">Full name or nickname<input name="displayName" required minLength={3} autoComplete="name" className="mt-2 w-full rounded-xl border border-forest-900/15 bg-white px-4 py-3 font-normal"/></label><label className="block text-sm font-bold text-forest-900">New password<input name="password" type="password" required minLength={10} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-forest-900/15 bg-white px-4 py-3 font-normal"/></label><label className="block text-sm font-bold text-forest-900">Confirm new password<input name="confirmPassword" type="password" required minLength={10} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-forest-900/15 bg-white px-4 py-3 font-normal"/></label><label className="flex gap-3 text-sm leading-6 text-gray-600"><input name="acceptedTerms" type="checkbox" required className="mt-1 size-4 accent-forest-800"/><span>By creating this account, I agree to the <a className="font-bold text-clay-700 underline" href="/terms" target="_blank">Terms of use</a> and <a className="font-bold text-clay-700 underline" href="/privacy" target="_blank">Privacy notice</a>.</span></label>{message && <p className="rounded-xl bg-clay-50 p-3 text-sm text-clay-700" role="status">{message}</p>}<button disabled={pending} className="w-full rounded-xl bg-forest-800 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-60">{pending ? "Saving…" : "Save and enter workspace"}</button></form>;
}
