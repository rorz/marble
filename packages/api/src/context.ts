import { getApiKeyTokenFromHeaders } from "@marble/keys";
import { MarbleStore } from "@marble/store";
import { createClient } from "@marble/supabase";
import { ORPCError } from "@orpc/server";

export type MarbleApiConfig = {
  supabase: {
    publishableKey: string;
    url: string;
  };
};

type MarbleApiRuntime = {
  publishableKey: string;
  supabaseUrl: string;
};

export type ApiTimingEntry = {
  durationMs: number;
  name: string;
};

export type ApiAuth =
  | {
      accessToken: string;
      profileId: string;
      type: "forwarded";
      userId?: string;
    }
  | {
      profileId: string;
      type: "public-docs";
    };

export type ApiContext = {
  auth: ApiAuth;
  recordTiming: (name: string, durationMs: number) => void;
  requestId: string;
  store: MarbleStore;
  timings: ApiTimingEntry[];
};

const OPENAPI_DOCS_PROFILE_ID = "00000000-0000-0000-0000-000000000000";
type ForwardedApiAuth = Extract<
  ApiAuth,
  {
    type: "forwarded";
  }
>;

export function createMarbleApiRuntime(
  config: MarbleApiConfig,
): MarbleApiRuntime {
  return {
    publishableKey: config.supabase.publishableKey,
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

function requireForwardedAuth(request: Request): ForwardedApiAuth {
  const profileId = request.headers.get("x-marble-auth-profile-id")?.trim();
  const accessToken = getBearerToken(request);

  if (!profileId || !accessToken) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Missing Marble auth context.",
    });
  }

  return {
    accessToken,
    profileId,
    type: "forwarded",
    userId: request.headers.get("x-marble-auth-user-id")?.trim() || undefined,
  };
}

function resolveApiAuth(request: Request): ForwardedApiAuth {
  const token = getApiKeyTokenFromHeaders(request.headers);

  if (!token) {
    return requireForwardedAuth(request);
  }

  throw new ORPCError("UNAUTHORIZED", {
    message: "Marble API keys are not supported by this RLS-backed API yet.",
  });
}

function createForwardedSupabaseClient(
  runtime: MarbleApiRuntime,
  auth: ForwardedApiAuth,
) {
  return createClient(runtime.supabaseUrl, runtime.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    },
  });
}

export async function createApiContext(
  request: Request,
  runtime: MarbleApiRuntime,
): Promise<ApiContext> {
  const auth = resolveApiAuth(request);
  const supabase = createForwardedSupabaseClient(runtime, auth);
  const timings: ApiTimingEntry[] = [];
  const recordTiming = (name: string, durationMs: number) => {
    timings.push({
      durationMs,
      name,
    });
  };

  return {
    auth,
    recordTiming,
    requestId:
      request.headers.get("x-marble-request-id") ?? crypto.randomUUID(),
    store: new MarbleStore({
      context: {
        profileId: auth.profileId,
        recordTiming,
      },
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
    auth: {
      profileId: OPENAPI_DOCS_PROFILE_ID,
      type: "public-docs",
    },
    recordTiming: () => {},
    requestId:
      request.headers.get("x-marble-request-id") ?? crypto.randomUUID(),
    store: new MarbleStore({
      context: {
        profileId: OPENAPI_DOCS_PROFILE_ID,
      },
      supabase,
    }),
    timings: [],
  };
}
