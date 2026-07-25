"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export function getSupabaseBrowser(): SupabaseClient | null {
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey);
}
