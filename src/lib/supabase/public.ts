import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Talikha Publishing is intentionally standalone. Keeping this compatibility
 * boundary prevents any old content code from initiating a remote connection.
 */
export function getPublicSupabase(): SupabaseClient | null {
  return null;
}
