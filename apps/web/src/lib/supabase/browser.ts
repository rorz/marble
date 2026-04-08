import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserKey, getSupabaseUrl } from "./config";

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseBrowserKey());
}
