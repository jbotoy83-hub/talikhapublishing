import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export function getPublicSupabase(): SupabaseClient | null {
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
