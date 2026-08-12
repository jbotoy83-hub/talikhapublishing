"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const IDLE_USERNAMES = ["definitely.not.admin", "ctrl.alt.defeat", "typing.since.monday", "currently.confused", "accidentally.logged.in", "research.ranger", "i am just a cat", "captain.citation", "professor.publishing", "the.peer.reviewer", "bruce.bibliography", "miles.manuscript", "professor.peerreview", "doctor.dissertation", "captain.correlation", "feature.not.bug", "talikha.scholar", "talikha.publisher", "talikha.reviewer"];

export function AdminLoginForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [idleUsername, setIdleUsername] = useState("Your team username");
  const usernameRef = useRef<HTMLInputElement>(null);
  const requestedNext = typeof window === "undefined" ? "/admin" : new URLSearchParams(window.location.search).get("next") || "/admin";
  const next = requestedNext.startsWith("/admin") ? requestedNext : "/admin";

  useEffect(() => {
    let timer = 0;
    let cancelled = false;
    const schedule = (callback: () => void, delay: number) => { timer = window.setTimeout(callback, delay); };
    const run = () => {
      const input = usernameRef.current;
      if (cancelled) return;
      if (!input || document.activeElement === input || input.value) { schedule(run, 1800); return; }
      const username = IDLE_USERNAMES[Math.floor(Math.random() * IDLE_USERNAMES.length)];
      let index = 0;
      const type = () => {
        if (cancelled) return;
        if (document.activeElement === input || input.value) { setIdleUsername("Your team username"); schedule(run, 1800); return; }
        setIdleUsername(username.slice(0, index));
        index += 1;
        if (index <= username.length) schedule(type, 82 + Math.random() * 48);
        else schedule(erase, 1050 + Math.random() * 1050);
      };
      const erase = () => {
        if (cancelled) return;
        if (document.activeElement === input || input.value) { setIdleUsername("Your team username"); schedule(run, 1800); return; }
        index -= 1;
        setIdleUsername(username.slice(0, Math.max(0, index)));
        if (index > 0) schedule(erase, 44 + Math.random() * 35);
        else { setIdleUsername("Your team username"); schedule(run, 650 + Math.random() * 1200); }
      };
      setIdleUsername("");
      schedule(type, 360 + Math.random() * 900);
    };
    schedule(run, 30000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage("");
    const supabase = getSupabaseBrowser();
    if (!supabase) { setMessage("Supabase authentication is not configured."); setPending(false); return; }
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") || "").trim().toLocaleLowerCase();
    const email = username.includes("@") ? username : `${username.replace(/[^a-z0-9._-]/g, "")}@team.talikha.internal`;
    const { error } = await supabase.auth.signInWithPassword({ email, password: String(data.get("password") || "") });
    if (error) { setMessage("Sign-in failed. Check your username and password."); setPending(false); return; }
    await fetch("/api/admin/activity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "admin_signed_in" }) }).catch(() => undefined);
    window.location.href = `/admin/welcome?next=${encodeURIComponent(next)}`;
  }

  return <form onSubmit={login} className="admin-login-form mt-10 space-y-5"><label className="flex h-14 items-center gap-4 rounded-[10px] border border-white/20 bg-[#151515] px-5 text-base text-white"><input ref={usernameRef} name="username" type="text" required autoComplete="username" spellCheck="false" placeholder={idleUsername} className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/38"/><span className="shrink-0 font-medium">Username</span></label><label className="flex h-14 items-center gap-4 rounded-[10px] border border-white/20 bg-[#151515] px-5 text-base text-white"><input name="password" type="password" required autoComplete="current-password" placeholder="••••••••••" className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/38"/><span className="shrink-0 font-medium">Password</span></label>{message && <p className="rounded-[10px] border border-clay-500/40 bg-clay-500/15 p-3 text-sm text-clay-100" role="status">{message}</p>}<button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-white px-5 py-3.5 text-sm font-bold text-black transition-colors hover:bg-white/85 disabled:opacity-60">{pending && <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black"/>}{pending ? "Signing in…" : "Sign in"}</button></form>;
}
