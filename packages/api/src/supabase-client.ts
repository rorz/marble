import type { ResourceActions } from "@marble/store";
import { MarbleStore } from "@marble/store";
import type { SupabaseClient } from "@marble/supabase";
import { createRouterClient } from "@orpc/server";
import type { ApiContext, ApiTimingEntry } from "./context";
import { marbleRouter } from "./router";

type SupabaseClientApiContextInput = {
  actions?: ResourceActions;
  profileId: string;
  requestId?: string;
  serviceSupabase?: SupabaseClient;
  supabase: SupabaseClient;
  userId?: string;
};

export const createSupabaseClientApiContext = ({
  actions,
  profileId,
  requestId,
  serviceSupabase,
  supabase,
  userId,
}: SupabaseClientApiContextInput): ApiContext => {
  const timings: ApiTimingEntry[] = [];
  const recordTiming = (name: string, durationMs: number) => {
    timings.push({
      durationMs,
      name,
    });
  };
  const resolvedRequestId = requestId ?? crypto.randomUUID();

  return {
    actor: null,
    recordTiming,
    requestId: resolvedRequestId,
    store: new MarbleStore({
      actions,
      context: {
        eventSource: "WEB_APP",
        profileId,
        recordTiming,
        requestId: resolvedRequestId,
        userId,
      },
      serviceSupabase,
      supabase,
    }),
    timings,
  };
};

const resolveSupabaseClientProfileId = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase
    .from("profile")
    .select("id")
    .eq("type", "Human")
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
};

export const createSupabaseClientRouterClient = ({
  actions,
  profileId: explicitProfileId,
  serviceSupabase,
  supabase,
  userId,
}: {
  actions?: ResourceActions;
  profileId?: string;
  serviceSupabase?: SupabaseClient;
  supabase: SupabaseClient;
  userId?: string;
}) => {
  let profileId: Promise<string> | null = null;
  const getProfileId = () => {
    if (explicitProfileId) {
      return Promise.resolve(explicitProfileId);
    }

    profileId ??= resolveSupabaseClientProfileId(supabase);
    return profileId;
  };

  return createRouterClient(marbleRouter, {
    context: async () =>
      createSupabaseClientApiContext({
        actions,
        profileId: await getProfileId(),
        serviceSupabase,
        supabase,
        userId,
      }),
  });
};
