import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { createMarbleStore, type MarbleStore } from "@marble/store";
import { createClient, type SupabaseClient } from "@marble/supabase";
import { ORPCError } from "@orpc/server";

export type MarbleApiConfig = {
  supabase: {
    serviceRoleKey: string;
    url: string;
  };
};

export type MarbleApiRuntime = {
  serviceRoleSupabase: SupabaseClient;
};

export type ApiAuth =
  | {
      keyId: string;
      profileId: string;
      type: "api-key";
    }
  | {
      profileId: string;
      type: "forwarded";
      userId?: string;
    };

export type ApiContext = {
  auth: ApiAuth;
  requestId: string;
  store: MarbleStore;
};

export function createMarbleApiRuntime(
  config: MarbleApiConfig,
): MarbleApiRuntime {
  return {
    serviceRoleSupabase: createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
    ),
  };
}

function requireForwardedAuth(request: Request): ApiAuth {
  const profileId = request.headers.get("x-marble-auth-profile-id")?.trim();

  if (!profileId) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Missing Marble auth context.",
    });
  }

  return {
    profileId,
    type: "forwarded",
    userId: request.headers.get("x-marble-auth-user-id")?.trim() || undefined,
  };
}

export async function resolveApiAuth(
  request: Request,
  runtime: MarbleApiRuntime,
): Promise<ApiAuth> {
  const token = getApiKeyTokenFromHeaders(request.headers);

  if (!token) {
    return requireForwardedAuth(request);
  }

  const resolved = await resolveApiKeyAuth(runtime.serviceRoleSupabase, token);

  if (!resolved?.profile) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid Marble API key.",
    });
  }

  return {
    keyId: resolved.id,
    profileId: resolved.profile.id,
    type: "api-key",
  };
}

export async function createApiContext(
  request: Request,
  runtime: MarbleApiRuntime,
): Promise<ApiContext> {
  const auth = await resolveApiAuth(request, runtime);

  return {
    auth,
    requestId:
      request.headers.get("x-marble-request-id") ?? crypto.randomUUID(),
    store: createMarbleStore({
      context: {
        profileId: auth.profileId,
      },
      supabase: runtime.serviceRoleSupabase,
    }),
  };
}
