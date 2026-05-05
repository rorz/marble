import "server-only";
import type { MarbleApiConfig as MarbleApiV2Config } from "@marble/api";
import type { MarbleApiConfig as LegacyMarbleApiConfig } from "@marble/old-api";
import { env } from "@/env";

type MarbleApiConfig = LegacyMarbleApiConfig & MarbleApiV2Config;

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
    ingestor: {
      url: env.MARBLE_INGESTOR_URL,
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
