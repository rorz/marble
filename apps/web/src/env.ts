import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_MARBLE_WEB_SESSION_API_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .startsWith("sb_publishable_"),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_MARBLE_WEB_SESSION_API_URL:
      process.env.NEXT_PUBLIC_MARBLE_WEB_SESSION_API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
  server: {
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    MARBLE_AGENT_PROVIDER: z.enum([
      "anthropic",
      "google",
      "openai",
    ]),
    MARBLE_EXECUTOR_URL: z.url(),
    MARBLE_INGESTOR_URL: z.url(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    SUPABASE_JWT_SECRET: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1), // TODO: Change to secret key
  },
});
