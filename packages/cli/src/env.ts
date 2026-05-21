import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const readCliEnv = (runtimeEnv: NodeJS.ProcessEnv) =>
  createEnv({
    client: {},
    clientPrefix: "",
    runtimeEnv,
    server: {
      MARBLE_API_KEY: z.string().min(1),
      MARBLE_API_URL: z.url().default("https://marble.zone/api"),
    },
  });
