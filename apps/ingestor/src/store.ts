import { MarbleStore } from "@marble/store";
import { createClient } from "@marble/supabase";

export const workerStore = (env: Env) => {
  const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return new MarbleStore({
    context: {
      eventSource: "RAW_API",
    },
    serviceSupabase: supabase,
    supabase,
  });
};
