import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Prevent the inherited admin routes from connecting to an external service. */
export function getSupabaseAdmin(): SupabaseClient | null {
  return null;
}
