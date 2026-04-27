import "server-only";
import type { MarbleApiConfig } from "@marble/api";
import { env } from "@/env";

export type ServiceRoleSupabaseConfig = {
  serviceRoleKey: string;
  url: string;
};

export function getServiceRoleSupabaseConfig(): ServiceRoleSupabaseConfig {
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
    supabase: getServiceRoleSupabaseConfig(),
  };
}

export function getMarbleIngestorBaseUrl() {
  return env.MARBLE_INGESTOR_URL.replace(/\/$/, "");
}
