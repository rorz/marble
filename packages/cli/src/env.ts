import { createEnv } from "@t3-oss/env-core";
import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: {
    INIT_CWD: z.string().optional(),
    MARBLE_API_KEY: z.string().optional(),
    MARBLE_API_URL: z.string().url().default("https://marble.kenobi.tech/api"),
  },
});
