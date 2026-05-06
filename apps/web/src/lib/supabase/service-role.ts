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
