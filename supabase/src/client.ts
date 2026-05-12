import { createClient as _createClient } from "@supabase/supabase-js";
import type { Database } from "./types.generated";

export type SupabaseClient = ReturnType<typeof createClient>;

export function createClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: Parameters<typeof _createClient>[2],
) {
  return _createClient<Database>(supabaseUrl, supabaseKey, options);
}
