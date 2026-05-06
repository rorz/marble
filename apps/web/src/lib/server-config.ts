import "server-only";
import type { MarbleApiConfig as MarbleApiV2Config } from "@marble/api";
import { env } from "@/env";

type MarbleApiConfig = MarbleApiV2Config;

type LegacySupabaseConfig = {
  serviceRoleKey: string;
  url: string;
};

export function getServiceRoleSupabaseConfig(): LegacySupabaseConfig {
  return {
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    url: env.NEXT_PUBLIC_SUPABASE_URL,
  };
}

export function getMarbleApiConfig(): MarbleApiConfig {
  return {
    executor: {
      url: env.MARBLE_EXECUTOR_URL,
    },
    supabase: {
      ...getServiceRoleSupabaseConfig(),
      publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    },
  };
}

export function getMarbleIngestorBaseUrl() {
  return env.MARBLE_INGESTOR_URL.replace(/\/$/, "");
}
