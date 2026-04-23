import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const getEnv = (
  runtimeEnv: Record<string, unknown> | NodeJS.ProcessEnv,
) => {
  return createEnv({
    emptyStringAsUndefined: true,
    runtimeEnv: runtimeEnv as Record<
      string,
      string | boolean | number | undefined
    >,
    server: {
      MARBLE_EXECUTOR_URL: z.string().url().optional(),
      MARBLE_INGESTOR_URL: z.string().url().optional(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
      SUPABASE_URL: z.string().url(),
    },
  });
};
