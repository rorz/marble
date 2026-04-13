import "server-only";
import { createClient } from "@marble/supabase";
import { env } from "@/env";

function requireServiceRoleCredentials() {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    key,
    url,
  };
}

export function createServiceRoleClient(headers?: Record<string, string>) {
  const { key, url } = requireServiceRoleCredentials();

  if (!headers) {
    return createClient(url, key);
  }

  return createClient(url, key, {
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
