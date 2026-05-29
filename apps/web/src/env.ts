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
    // harness-ignore: no-optional-env -- Conditioned by MARBLE_AGENT_PROVIDER; only the selected provider key must exist.
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ELEVENLABS_API_KEY: z.string().min(1),
    EXA_API_KEY: z.string().min(1),
    // harness-ignore: no-optional-env -- Conditioned by MARBLE_AGENT_PROVIDER; only the selected provider key must exist.
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    MARBLE_AGENT_PROVIDER: z.enum([
      "anthropic",
      "google",
      "openai",
    ]),
    // harness-ignore: no-optional-env -- Required in production where Cloudflare Access guards the executor; omitted in local dev.
    MARBLE_EXECUTOR_ACCESS_CLIENT_ID: z.string().min(1).optional(),
    // harness-ignore: no-optional-env -- Required in production where Cloudflare Access guards the executor; omitted in local dev.
    MARBLE_EXECUTOR_ACCESS_CLIENT_SECRET: z.string().min(1).optional(),
    MARBLE_EXECUTOR_URL: z.url(),
    MARBLE_INGESTOR_URL: z.url(),
    // harness-ignore: no-optional-env -- Required in production (shared with the executor); omitted in local dev.
    MARBLE_INTERNAL_SECRET: z.string().min(1).optional(),
    // harness-ignore: no-optional-env -- Conditioned by MARBLE_AGENT_PROVIDER; only the selected provider key must exist.
    OPENAI_API_KEY: z.string().min(1).optional(),
    SUPABASE_JWT_SECRET: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1), // TODO: Change to secret key
  },
});
