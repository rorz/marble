import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { toBase64Url } from "@marble/lib/crypto";
import { createClient, type SupabaseClient } from "@marble/supabase";
import { ORPCError } from "@orpc/server";
import type { ApiActor, MarbleApiRuntime } from ".";

const getBearerToken = (request: Request) => {
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
};

const requireSupabaseSessionActor = async (
  request: Request,
  runtime: MarbleApiRuntime,
  serviceSupabase: SupabaseClient,
): Promise<ApiActor> => {
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
};

const requireApiKeyActor = async (
  serviceSupabase: SupabaseClient,
  token: string,
): Promise<ApiActor> => {
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
};

export const resolveHostedApiActor = async (
  request: Request,
  runtime: MarbleApiRuntime,
  serviceSupabase: SupabaseClient,
): Promise<ApiActor> => {
  const token = getApiKeyTokenFromHeaders(request.headers);

  if (token) {
    return requireApiKeyActor(serviceSupabase, token);
  }

  return requireSupabaseSessionActor(request, runtime, serviceSupabase);
};

const signApiKeyActorAccessToken = async (
  runtime: MarbleApiRuntime,
  actor: Extract<
    ApiActor,
    {
      type: "api-key";
    }
  >,
) => {
  if (!runtime.jwtSecret) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "SUPABASE_JWT_SECRET is required for API key data access.",
    });
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = toBase64Url(
    JSON.stringify({
      alg: "HS256",
      typ: "JWT",
    }),
  );
  const payload = toBase64Url(
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

  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
};

export const createActorSupabaseClient = async (
  runtime: MarbleApiRuntime,
  actor: ApiActor,
) => {
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
};
