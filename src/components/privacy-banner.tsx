"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ANALYTICS_ENABLED, CONSENT_STORAGE_KEY } from "@/lib/site";
import { Icon } from "./icon";

export function PrivacyBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    const timer = window.setTimeout(() => setVisible(!localStorage.getItem(CONSENT_STORAGE_KEY)), 0);
    return () => window.clearTimeout(timer);
  }, []);
  function choose(value: "all" | "essential") {
    localStorage.setItem(CONSENT_STORAGE_KEY, value);
    setVisible(false);
  }
  if (!visible) return null;
  return <div className="fixed inset-x-3 bottom-3 z-[80] rounded-2xl border border-forest-900/10 bg-white p-4 shadow-2xl sm:left-auto sm:max-w-md"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-800"><Icon name="shield"/></span><div><p className="text-sm font-bold text-forest-900">Your privacy choices</p><p className="mt-1 text-xs leading-5 text-gray-500">We use essential storage and, with your permission, analytics to improve reading and discovery.</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>choose("all")} className="rounded-lg bg-forest-800 px-3 py-2 text-xs font-bold text-white">Accept analytics</button><button onClick={()=>choose("essential")} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700">Essential only</button><Link href="/privacy" className="px-2 py-2 text-xs font-bold text-clay-700">Read the privacy notice</Link></div></div></div></div>;
}
