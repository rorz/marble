import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { MarbleStore } from "@marble/store";
import { createClient, type SupabaseClient } from "@marble/supabase";
import { ORPCError } from "@orpc/server";
import { createExecutorActions } from "./executor";

export type MarbleApiConfig = {
  executor?: {
    transport?: {
      fetch: (request: Request) => Promise<Response> | Response;
    };
    url: string;
  };
  supabase: {
    publishableKey: string;
    serviceRoleKey: string;
    url: string;
  };
};

export type MarbleApiRuntime = {
  executor?: {
    transport?: {
      fetch: (request: Request) => Promise<Response> | Response;
    };
    url: string;
  };
  publishableKey: string;
  serviceRoleKey: string;
  supabaseUrl: string;
};

export type ApiTimingEntry = {
  durationMs: number;
  name: string;
};

export type ApiActor =
  | {
      keyId: string;
      profileId: string;
      type: "api-key";
      userId: string;
    }
  | {
      accessToken: string;
      profileId: string;
      type: "supabase-session";
      userId: string;
    };

export type ApiContext = {
  actor: ApiActor | null;
  recordTiming: (name: string, durationMs: number) => void;
  requestId: string;
  runtime?: MarbleApiRuntime;
  store: MarbleStore;
  timings: ApiTimingEntry[];
};

const OPENAPI_DOCS_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

export function createMarbleApiRuntime(
  config: MarbleApiConfig,
): MarbleApiRuntime {
  return {
    ...(config.executor
      ? {
          executor: {
            transport: config.executor.transport,
            url: config.executor.url.replace(/\/$/, ""),
          },
        }
      : {}),
    publishableKey: config.supabase.publishableKey,
    serviceRoleKey: config.supabase.serviceRoleKey,
    supabaseUrl: config.supabase.url,
  };
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, credentials, ...rest] = authorization.trim().split(/\s+/);

  if (rest.length > 0 || scheme.toLowerCase() !== "bearer" || !credentials) {
    return null;
  }

  return credentials.trim();
}

function requireSupabaseSessionActor(request: Request): ApiActor {
  const profileId = request.headers.get("x-marble-auth-profile-id")?.trim();
  const userId = request.headers.get("x-marble-auth-user-id")?.trim();
  const accessToken = getBearerToken(request);

  if (!profileId || !userId || !accessToken) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Missing Marble auth context.",
    });
  }

  return {
    accessToken,
    profileId,
    type: "supabase-session",
    userId,
  };
}

async function requireApiKeyActor(
  serviceSupabase: SupabaseClient,
  token: string,
): Promise<ApiActor> {
  const keyAuth = await resolveApiKeyAuth(serviceSupabase, token);
  const userId = keyAuth?.profile?.owner_user_id;

  if (!keyAuth || !userId) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid Marble API key.",
    });
  }

  return {
    keyId: keyAuth.id,
    profileId: keyAuth.owner_profile_id,
    type: "api-key",
    userId,
  };
}

async function resolveHostedApiActor(
  request: Request,
  serviceSupabase: SupabaseClient,
): Promise<ApiActor> {
  const token = getApiKeyTokenFromHeaders(request.headers);

  if (token) {
    return requireApiKeyActor(serviceSupabase, token);
  }

  return requireSupabaseSessionActor(request);
}

function createActorSupabaseClient(
  runtime: MarbleApiRuntime,
  serviceSupabase: SupabaseClient,
  actor: ApiActor,
) {
  if (actor.type === "api-key") {
    return serviceSupabase;
  }

  return createClient(runtime.supabaseUrl, runtime.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${actor.accessToken}`,
      },
    },
  });
}

export async function createHostedApiContext(
  request: Request,
  runtime: MarbleApiRuntime,
): Promise<ApiContext> {
  const serviceSupabase = createClient(
    runtime.supabaseUrl,
    runtime.serviceRoleKey,
  );
  const actor = await resolveHostedApiActor(request, serviceSupabase);
  const supabase = createActorSupabaseClient(runtime, serviceSupabase, actor);
  const timings: ApiTimingEntry[] = [];
  const recordTiming = (name: string, durationMs: number) => {
    timings.push({
      durationMs,
      name,
    });
  };

  return {
    actor,
    recordTiming,
    requestId:
      request.headers.get("x-marble-request-id") ?? crypto.randomUUID(),
    runtime,
    store: new MarbleStore({
      actions: createExecutorActions(runtime, actor, request),
      context: {
        profileId: actor.profileId,
        recordTiming,
        userId: actor.userId,
      },
      serviceSupabase,
      supabase,
    }),
    timings,
  };
}

export function createOpenApiDocsContext(
  request: Request,
  runtime: MarbleApiRuntime,
): ApiContext {
  const supabase = createClient(runtime.supabaseUrl, runtime.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return {
    actor: null,
    recordTiming: () => {},
    requestId:
      request.headers.get("x-marble-request-id") ?? crypto.randomUUID(),
    runtime,
    store: new MarbleStore({
      context: {
        profileId: OPENAPI_DOCS_PROFILE_ID,
      },
      supabase,
    }),
    timings: [],
  };
}
