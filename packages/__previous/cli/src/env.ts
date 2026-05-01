import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const server = {
  MARBLE_API_KEY: z.string().min(1),
  MARBLE_API_URL: z.url(),
};

export function readCliEnv(runtimeEnv: Record<string, string | undefined>) {
  return createEnv({
    emptyStringAsUndefined: true,
    runtimeEnv,
    server,
  });
}

export type CliEnv = ReturnType<typeof readCliEnv>;
