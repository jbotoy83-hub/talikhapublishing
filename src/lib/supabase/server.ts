import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Server-side external authentication is disabled for Talikha. */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  return null;
}
