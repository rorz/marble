import { trimTrailingSlash } from "@marble/lib/string";
import { MarbleStore, type ResourceContext } from "@marble/store";
import { createClient } from "@marble/supabase";
import { createExecutorActions } from "../executor";
import { createActorSupabaseClient, resolveHostedApiActor } from "./actor";

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

const normalizeEventSource = (
  value: string | null | undefined,
): ResourceContext["eventSource"] | undefined => {
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
};

const resolveEventSource = (options: {
  actorKeyId?: string;
  forwardedUserId?: string;
  requestedActorSource?: string | null;
}): ResourceContext["eventSource"] => {
  return (
    normalizeEventSource(options.requestedActorSource) ??
    (options.forwardedUserId ? "WEB_APP" : undefined) ??
    (options.actorKeyId ? "RAW_API" : "RAW_API")
  );
};

export const createMarbleApiRuntime = (
  config: MarbleApiConfig,
): MarbleApiRuntime => {
  return {
    ...(config.executor
      ? {
          executor: {
            transport: config.executor.transport,
            url: trimTrailingSlash(config.executor.url),
          },
        }
      : {}),
    jwtSecret: config.supabase.jwtSecret,
    publishableKey: config.supabase.publishableKey,
    serviceRoleKey: config.supabase.serviceRoleKey,
    supabaseUrl: config.supabase.url,
  };
};

export const createHostedApiContext = async (
  request: Request,
  runtime: MarbleApiRuntime,
): Promise<ApiContext> => {
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
};

export const createOpenApiDocsContext = (
  request: Request,
  runtime: MarbleApiRuntime,
): ApiContext => {
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
};
