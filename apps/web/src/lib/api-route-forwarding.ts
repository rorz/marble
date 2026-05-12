import "server-only";
import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { formatServerTimingEntry } from "@marble/lib/timing";
import { NextResponse } from "next/server";
import { getCurrentSupabaseAccessToken, getCurrentUser } from "./auth";
import {
  createServiceRoleClient,
  maybeResolveOwnedProfileId,
} from "./supabase/service-role";

type MarbleApiFetcher = {
  fetch: (request: Request) => Promise<Response> | Response;
};

type ForwardMarbleApiRequestOptions = {
  api: MarbleApiFetcher;
  forwardUserSupabaseAuth?: boolean;
  profilelessPaths?: string[];
  publicPaths?: string[];
  stripPathPrefix: string;
};

const PROFILELESS_PROFILE_ID = "00000000-0000-0000-0000-000000000000";
const MARBLE_SERVER_TIMING_HEADER = "x-marble-server-timing";
const SERVER_TIMING_HEADER = "Server-Timing";

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

function isProfilelessForwardedPath(
  pathname: string,
  profilelessPaths: string[] = [],
) {
  return profilelessPaths.includes(pathname);
}

function shouldDebugTiming(request: Request) {
  return request.headers.get("x-marble-debug-timing") === "1";
}

export async function forwardMarbleApiRequest(
  req: Request,
  options: ForwardMarbleApiRequestOptions,
) {
  const startedAt = performance.now();
  const requestId =
    req.headers.get("x-marble-request-id")?.trim() || crypto.randomUUID();
  const debugTiming = shouldDebugTiming(req);
  const timings: string[] = [];
  const recordTiming = (name: string, started: number) => {
    timings.push(formatServerTimingEntry(name, performance.now() - started));
  };
  const apiKeyToken = getApiKeyTokenFromHeaders(req.headers);
  const requestedProfileId = req.headers.get("x-marble-profile-id")?.trim();
  let authContext: {
    accessToken?: string;
    keyId?: string;
    profileId?: string;
    userId?: string;
  } | null = null;
  const url = new URL(req.url);
  url.pathname = stripPathPrefix(url.pathname, options.stripPathPrefix);
  const publicPath = isPublicForwardedPath(url.pathname, options.publicPaths);
  const profilelessPath = isProfilelessForwardedPath(
    url.pathname,
    options.profilelessPaths,
  );
  const authStartedAt = performance.now();

  if (publicPath) {
    timings.push(formatServerTimingEntry("auth", 0));
  } else if (apiKeyToken) {
    if (options.forwardUserSupabaseAuth) {
      authContext = null;
    } else {
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
    }
  } else {
    if (profilelessPath) {
      const sessionStartedAt = performance.now();
      const [accessToken, user] = options.forwardUserSupabaseAuth
        ? await Promise.all([
            getCurrentSupabaseAccessToken(),
            getCurrentUser(),
          ])
        : [
            undefined,
            null,
          ];
      recordTiming("session", sessionStartedAt);

      if (options.forwardUserSupabaseAuth && (!accessToken || !user)) {
        return NextResponse.json(
          {
            error: "Unauthorized",
          },
          {
            status: 401,
          },
        );
      }

      authContext = {
        accessToken: accessToken ?? undefined,
        profileId: PROFILELESS_PROFILE_ID,
        userId: user?.id,
      };
    } else {
      const userStartedAt = performance.now();
      const user = await getCurrentUser();
      recordTiming("user", userStartedAt);

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
      const profileId = await maybeResolveOwnedProfileId(
        user.id,
        requestedProfileId,
      );
      recordTiming("profile", profileStartedAt);
      const sessionStartedAt = performance.now();
      const accessToken = options.forwardUserSupabaseAuth
        ? await getCurrentSupabaseAccessToken()
        : undefined;
      recordTiming("session", sessionStartedAt);

      if (options.forwardUserSupabaseAuth && !accessToken) {
        return NextResponse.json(
          {
            error: "Unauthorized",
          },
          {
            status: 401,
          },
        );
      }

      authContext = {
        accessToken: accessToken ?? undefined,
        profileId,
        userId: user.id,
      };
    }
  }
  if (!publicPath) {
    recordTiming("auth", authStartedAt);
  }

  const forwardedReq = new Request(url, req);
  forwardedReq.headers.set("x-marble-request-id", requestId);
  forwardedReq.headers.delete("x-marble-profile-id");
  forwardedReq.headers.delete("x-marble-auth-profile-id");
  forwardedReq.headers.delete("x-marble-auth-user-id");
  forwardedReq.headers.delete("x-marble-auth-key-id");

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

    if (authContext.accessToken) {
      forwardedReq.headers.set(
        "Authorization",
        `Bearer ${authContext.accessToken}`,
      );
    }
  }

  const apiStartedAt = performance.now();
  const apiResponse = await options.api.fetch(forwardedReq);
  recordTiming("api", apiStartedAt);
  recordTiming("total", startedAt);

  const response = new Response(apiResponse.body, apiResponse);

  if (debugTiming) {
    const forwardedServerTiming =
      response.headers.get(MARBLE_SERVER_TIMING_HEADER) ??
      response.headers.get(SERVER_TIMING_HEADER);
    const serverTiming = [
      forwardedServerTiming,
      timings.join(", "),
    ]
      .filter(Boolean)
      .join(", ");
    response.headers.set(SERVER_TIMING_HEADER, serverTiming);
    response.headers.set(MARBLE_SERVER_TIMING_HEADER, serverTiming);
  }

  response.headers.set("x-marble-request-id", requestId);

  if (debugTiming) {
    console.log("[marble-api-forward] timing", {
      authType: apiKeyToken
        ? "api-key"
        : authContext?.keyId
          ? "api-key"
          : "user-session",
      path: url.pathname,
      profileless: profilelessPath,
      requestId,
      timings,
    });
  }

  return response;
}
