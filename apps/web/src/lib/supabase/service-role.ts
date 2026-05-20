import "server-only";
import { createClient } from "@marble/supabase";
import { getServiceRoleSupabaseConfig } from "../server-config";

export const createServiceRoleClient = (headers?: Record<string, string>) => {
  const config = getServiceRoleSupabaseConfig();

  if (!headers) {
    return createClient(config.url, config.serviceRoleKey);
  }

  return createClient(config.url, config.serviceRoleKey, {
    global: {
      headers,
    },
  });
};

type OwnedProfileType = "Agent" | "Human";

const resolveOwnedProfileIdByType = async (
  userId: string,
  type: OwnedProfileType,
) => {
  const { data, error } = await createServiceRoleClient()
    .from("profile")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("type", type)
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id;
};

export const maybeResolveOwnedProfileId = async (
  userId: string,
  profileId?: string | null,
  options: {
    defaultType?: OwnedProfileType;
  } = {},
) => {
  if (profileId) {
    const { data, error } = await createServiceRoleClient()
      .from("profile")
      .select("id")
      .eq("id", profileId)
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.id;
  }

  return resolveOwnedProfileIdByType(userId, options.defaultType ?? "Human");
};

export const resolveAgentProfileId = async (userId: string) =>
  resolveOwnedProfileIdByType(userId, "Agent");
