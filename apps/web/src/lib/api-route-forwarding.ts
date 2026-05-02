import "server-only";
import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import {
  createServiceRoleClient,
  maybeResolveOwnedProfileId,
} from "./supabase/service-role";

type MarbleApiFetcher = {
  fetch: (request: Request) => Promise<Response> | Response;
};

type ForwardMarbleApiRequestOptions = {
  api: MarbleApiFetcher;
  publicPaths?: string[];
  stripPathPrefix: string;
};

function stripPathPrefix(pathname: string, prefix: string) {
  if (pathname === prefix) {
    return "/";
  }

  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length);
  }

  return pathname;
}

function isPublicForwardedPath(pathname: string, publicPaths: string[] = []) {
  return publicPaths.includes(pathname);
}

export async function forwardMarbleApiRequest(
  req: Request,
  options: ForwardMarbleApiRequestOptions,
) {
  const startedAt = performance.now();
  const requestId =
    req.headers.get("x-marble-request-id")?.trim() || crypto.randomUUID();
  const timings: string[] = [];
  const apiKeyToken = getApiKeyTokenFromHeaders(req.headers);
  let authContext: {
    keyId?: string;
    profileId?: string;
    userId?: string;
  } | null = null;
  const url = new URL(req.url);
  url.pathname = stripPathPrefix(url.pathname, options.stripPathPrefix);
  const publicPath = isPublicForwardedPath(url.pathname, options.publicPaths);
  const authStartedAt = performance.now();

  if (publicPath) {
    timings.push("auth;dur=0");
  } else if (apiKeyToken) {
    const keyAuth = await resolveApiKeyAuth(
      createServiceRoleClient(),
      apiKeyToken,
    );

    if (!keyAuth) {
      const response = NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
      response.headers.set("x-marble-request-id", requestId);
      return response;
    }

    authContext = {
      keyId: keyAuth.id,
      profileId: keyAuth.owner_profile_id,
    };
  } else {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const profileStartedAt = performance.now();
    const profileId = await maybeResolveOwnedProfileId(user.id);
    timings.push(
      `profile;dur=${Math.round(performance.now() - profileStartedAt)}`,
    );

    authContext = {
      profileId,
      userId: user.id,
    };
  }
  if (!publicPath) {
    timings.push(`auth;dur=${Math.round(performance.now() - authStartedAt)}`);
  }

  const forwardedReq = new Request(url, req);
  forwardedReq.headers.set("x-marble-request-id", requestId);

  if (authContext) {
    forwardedReq.headers.delete("Authorization");
    forwardedReq.headers.delete("authorization");
    forwardedReq.headers.delete("x-api-key");

    if (authContext.keyId) {
      forwardedReq.headers.set("x-marble-auth-key-id", authContext.keyId);
    }

    if (authContext.profileId) {
      forwardedReq.headers.set(
        "x-marble-auth-profile-id",
        authContext.profileId,
      );
    }

    if (authContext.userId) {
      forwardedReq.headers.set("x-marble-actor-source", "WEB_APP");
      forwardedReq.headers.set("x-marble-auth-user-id", authContext.userId);
    }
  }

  const apiStartedAt = performance.now();
  const apiResponse = await options.api.fetch(forwardedReq);
  timings.push(`api;dur=${Math.round(performance.now() - apiStartedAt)}`);
  timings.push(`total;dur=${Math.round(performance.now() - startedAt)}`);

  const response = new Response(apiResponse.body, apiResponse);
  const apiServerTiming = response.headers.get("Server-Timing");
  response.headers.set(
    "Server-Timing",
    [
      apiServerTiming,
      timings.join(", "),
    ]
      .filter(Boolean)
      .join(", "),
  );
  response.headers.set("x-marble-request-id", requestId);
  return response;
}
