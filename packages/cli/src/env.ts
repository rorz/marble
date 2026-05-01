import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const readCliEnv = (runtimeEnv: NodeJS.ProcessEnv) =>
  createEnv({
    client: {},
    clientPrefix: "",
    runtimeEnv,
    server: {
      MARBLE_API_KEY: z.string().optional(),
      MARBLE_API_URL: z.string().url(),
    },
  });
