import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "./public-config";

export const createClient = () =>
  createBrowserClient(
    supabasePublicConfig.url,
    supabasePublicConfig.publishableKey,
  );
