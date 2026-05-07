import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { MarbleStore, type ResourceContext } from "@marble/store";
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
    jwtSecret: string;
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
  jwtSecret: string;
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

function normalizeEventSource(
  value: string | null | undefined,
): ResourceContext["eventSource"] | undefined {
  switch (value?.trim().toLowerCase()) {
    case "cli":
      return "CLI";
    case "api":
    case "raw-api":
    case "raw_api":
      return "RAW_API";
    case "web-app":
    case "web_app":
    case "webapp":
      return "WEB_APP";
    default:
      return undefined;
  }
}

function resolveEventSource(options: {
  actorKeyId?: string;
  forwardedUserId?: string;
  requestedActorSource?: string | null;
}): ResourceContext["eventSource"] {
  return (
    normalizeEventSource(options.requestedActorSource) ??
    (options.forwardedUserId ? "WEB_APP" : undefined) ??
    (options.actorKeyId ? "RAW_API" : "RAW_API")
  );
}

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
    jwtSecret: config.supabase.jwtSecret,
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

async function requireSupabaseSessionActor(
  request: Request,
  runtime: MarbleApiRuntime,
  serviceSupabase: SupabaseClient,
): Promise<ApiActor> {
  const profileId = request.headers.get("x-marble-auth-profile-id")?.trim();
  const accessToken = getBearerToken(request);

  if (!profileId || !accessToken) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Missing Marble auth context.",
    });
  }

  const authSupabase = createClient(
    runtime.supabaseUrl,
    runtime.publishableKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
  const { data, error } = await authSupabase.auth.getUser(accessToken);
  const userId = data.user?.id;

  if (error || !userId) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid Supabase session.",
    });
  }

  const { data: profile, error: profileError } = await serviceSupabase
    .from("profile")
    .select("id")
    .eq("id", profileId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new ORPCError("UNAUTHORIZED", {
      cause: profileError,
      message: "Invalid Marble profile context.",
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
  runtime: MarbleApiRuntime,
  serviceSupabase: SupabaseClient,
): Promise<ApiActor> {
  const token = getApiKeyTokenFromHeaders(request.headers);

  if (token) {
    return requireApiKeyActor(serviceSupabase, token);
  }

  return requireSupabaseSessionActor(request, runtime, serviceSupabase);
}

function base64UrlEncode(input: string | Uint8Array) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function signApiKeyActorAccessToken(
  runtime: MarbleApiRuntime,
  actor: Extract<
    ApiActor,
    {
      type: "api-key";
    }
  >,
) {
  if (!runtime.jwtSecret) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "SUPABASE_JWT_SECRET is required for API key data access.",
    });
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(
    JSON.stringify({
      alg: "HS256",
      typ: "JWT",
    }),
  );
  const payload = base64UrlEncode(
    JSON.stringify({
      aud: "authenticated",
      exp: issuedAt + 5 * 60,
      iat: issuedAt,
      iss: "marble-api",
      role: "authenticated",
      sub: actor.userId,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(runtime.jwtSecret),
    {
      hash: "SHA-256",
      name: "HMAC",
    },
    false,
    [
      "sign",
    ],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function createActorSupabaseClient(
  runtime: MarbleApiRuntime,
  actor: ApiActor,
) {
  const accessToken =
    actor.type === "api-key"
      ? await signApiKeyActorAccessToken(runtime, actor)
      : actor.accessToken;

  return createClient(runtime.supabaseUrl, runtime.publishableKey, {
    accessToken: async () => accessToken,
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
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
  const actor = await resolveHostedApiActor(request, runtime, serviceSupabase);
  const supabase = await createActorSupabaseClient(runtime, actor);
  const timings: ApiTimingEntry[] = [];
  const requestId =
    request.headers.get("x-marble-request-id") ?? crypto.randomUUID();
  const recordTiming = (name: string, durationMs: number) => {
    timings.push({
      durationMs,
      name,
    });
  };

  return {
    actor,
    recordTiming,
    requestId,
    runtime,
    store: new MarbleStore({
      actions: createExecutorActions(runtime, actor, request),
      context: {
        ...(actor.type === "api-key"
          ? {
              actorKeyId: actor.keyId,
            }
          : {}),
        eventSource: resolveEventSource({
          actorKeyId: actor.type === "api-key" ? actor.keyId : undefined,
          forwardedUserId:
            actor.type === "supabase-session" ? actor.userId : undefined,
          requestedActorSource: request.headers.get("x-marble-actor-source"),
        }),
        profileId: actor.profileId,
        recordTiming,
        requestId,
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
        eventSource: "RAW_API",
        profileId: OPENAPI_DOCS_PROFILE_ID,
      },
      supabase,
    }),
    timings: [],
  };
}
