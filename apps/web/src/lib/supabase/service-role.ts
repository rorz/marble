import "server-only";
import { createClient } from "@marble/supabase";
import { getServiceRoleSupabaseConfig } from "../server-config";

export function createServiceRoleClient(headers?: Record<string, string>) {
  const config = getServiceRoleSupabaseConfig();

  if (!headers) {
    return createClient(config.url, config.serviceRoleKey);
  }

  return createClient(config.url, config.serviceRoleKey, {
    global: {
      headers,
    },
  });
}

export async function resolveOwnedProfileId(userId: string) {
  const { data, error } = await createServiceRoleClient()
    .from("profile")
    .select("id")
    .eq("owner_user_id", userId)
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Could not find profile for user");
  }

  return data.id;
}

export async function maybeResolveOwnedProfileId(userId: string) {
  const { data, error } = await createServiceRoleClient()
    .from("profile")
    .select("id")
    .eq("owner_user_id", userId)
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id;
}

export async function listOwnedProfileIds(userId: string) {
  const { data, error } = await createServiceRoleClient()
    .from("profile")
    .select("id")
    .eq("owner_user_id", userId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []).map((profile) => profile.id);
}
