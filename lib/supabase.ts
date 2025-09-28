import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let cached: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!cached) {
    if (!url || !anonKey) {
      console.warn("Supabase URL or anon key is missing. Client will operate in offline mode.");
    }
    cached = createClient(url, anonKey, {
      auth: {
        persistSession: true
      }
    });
  }
  return cached;
}
