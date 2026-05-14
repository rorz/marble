// harness-ignore: no-forward-reference -- `createClient` in the import specifier is the supabase export name, not a reference to the local binding
import { createClient as _createClient } from "@supabase/supabase-js";
import type { Database } from "./types.generated";

export type SupabaseClient = ReturnType<typeof createClient>;

export const createClient = (
  supabaseUrl: string,
  supabaseKey: string,
  options?: Parameters<typeof _createClient>[2],
) => {
  return _createClient<Database>(supabaseUrl, supabaseKey, options);
};
