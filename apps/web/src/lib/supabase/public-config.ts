import { env } from "@/env";

export const supabasePublicConfig = {
  publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  url: env.NEXT_PUBLIC_SUPABASE_URL,
} as const;
