import { MarbleClient } from "@marble/sdk";
import type { BrowserSupabaseClient } from "./types";

export const createSupabaseMarbleClient = (supabase: BrowserSupabaseClient) => {
  return new MarbleClient({
    driver: {
      client: supabase,
      type: "supabase",
    },
  });
};
