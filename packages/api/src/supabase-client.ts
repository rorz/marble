import { MarbleStore } from "@marble/store";
import type { SupabaseClient } from "@marble/supabase";
import { createRouterClient } from "@orpc/server";
import type { ApiContext, ApiTimingEntry } from "./context";
import { marbleRouter } from "./router";

type SupabaseClientApiContextInput = {
  profileId: string;
  requestId?: string;
  supabase: SupabaseClient;
};

export function createSupabaseClientApiContext({
  profileId,
  requestId,
  supabase,
}: SupabaseClientApiContextInput): ApiContext {
  const timings: ApiTimingEntry[] = [];
  const recordTiming = (name: string, durationMs: number) => {
    timings.push({
      durationMs,
      name,
    });
  };

  return {
    auth: {
      profileId,
      type: "supabase-client",
    },
    recordTiming,
    requestId: requestId ?? crypto.randomUUID(),
    store: new MarbleStore({
      context: {
        profileId,
        recordTiming,
      },
      supabase,
    }),
    timings,
  };
}

async function resolveSupabaseClientProfileId(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profile")
    .select("id")
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Could not find profile for current Supabase user.");
  }

  return data.id;
}

export function createSupabaseClientRouterClient({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  let profileId: Promise<string> | null = null;
  const getProfileId = () => {
    profileId ??= resolveSupabaseClientProfileId(supabase);
    return profileId;
  };

  return createRouterClient(marbleRouter, {
    context: async () =>
      createSupabaseClientApiContext({
        profileId: await getProfileId(),
        supabase,
      }),
  });
}
