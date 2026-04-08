import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const getEnv = (runtimeEnv: Record<string, unknown>) => {
  return createEnv({
    server: {
      SUPABASE_URL: z.string().url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
      APOLLO_IO_API_KEY: z.string().optional(),
    },
    runtimeEnv: runtimeEnv as Record<
      string,
      string | boolean | number | undefined
    >,
    emptyStringAsUndefined: true,
  });
};
