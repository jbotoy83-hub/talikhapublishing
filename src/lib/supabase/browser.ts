"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Browser-side external storage and authentication are disabled for Talikha. */
export function getSupabaseBrowser(): SupabaseClient | null {
  return null;
}
