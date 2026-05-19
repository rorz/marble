import "server-only";
import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { formatServerTimingEntry, measure } from "@marble/lib/timing";
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

type ForwardedAuthContext = {
  accessToken?: string;
  keyId?: string;
  profileId?: string;
  userId?: string;
};

type ForwardedAuthResolution =
  | {
      authContext: ForwardedAuthContext | null;
      response?: never;
    }
  | {
      authContext?: never;
      response: NextResponse;
    };

const PROFILELESS_PROFILE_ID = "00000000-0000-0000-0000-000000000000";
const MARBLE_SERVER_TIMING_HEADER = "x-marble-server-timing";
const SERVER_TIMING_HEADER = "Server-Timing";

const stripPathPrefix = (pathname: string, prefix: string) => {
  if (pathname === prefix) {
    return "/";
  }

  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length);
  }

  return pathname;
};

const isPublicForwardedPath = (
  pathname: string,
  publicPaths: string[] = [],
) => {
  return publicPaths.includes(pathname);
};

const isProfilelessForwardedPath = (
  pathname: string,
  profilelessPaths: string[] = [],
) => {
  return profilelessPaths.includes(pathname);
};

const shouldDebugTiming = (request: Request) => {
  return request.headers.get("x-marble-debug-timing") === "1";
};

export const forwardMarbleApiRequest = async (
  req: Request,
  options: ForwardMarbleApiRequestOptions,
) => {
  const requestId =
    req.headers.get("x-marble-request-id")?.trim() || crypto.randomUUID();
  const debugTiming = shouldDebugTiming(req);
  const timings: string[] = [];
  const recordTiming = (name: string, durationMs: number) => {
    timings.push(formatServerTimingEntry(name, durationMs));
  };
  const apiKeyToken = getApiKeyTokenFromHeaders(req.headers);
  const requestedProfileId = req.headers.get("x-marble-profile-id")?.trim();
  let authContext: ForwardedAuthContext | null = null;
  const url = new URL(req.url);
  url.pathname = stripPathPrefix(url.pathname, options.stripPathPrefix);
  const publicPath = isPublicForwardedPath(url.pathname, options.publicPaths);
  const profilelessPath = isProfilelessForwardedPath(
    url.pathname,
    options.profilelessPaths,
  );

  const { durationMs: totalDurationMs, result: forwardingResult } =
    await measure(
      async (): Promise<{
        finalize: boolean;
        response: Response;
      }> => {
        if (publicPath) {
          recordTiming("auth", 0);
        } else {
          const { durationMs: authDurationMs, result: authResolution } =
            await measure(async (): Promise<ForwardedAuthResolution> => {
              if (apiKeyToken) {
                if (options.forwardUserSupabaseAuth) {
                  return {
                    authContext: null,
                  };
                }

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
                  return {
                    response,
                  };
                }

                return {
                  authContext: {
                    keyId: keyAuth.id,
                    profileId: keyAuth.owner_profile_id,
                  },
                };
              }

              if (profilelessPath) {
                const { durationMs: sessionDurationMs, result: session } =
                  await measure(async () => {
                    if (options.forwardUserSupabaseAuth) {
                      return Promise.all([
                        getCurrentSupabaseAccessToken(),
                        getCurrentUser(),
                      ]);
                    }

                    return [
                      null,
                      null,
                    ] satisfies [
                      string | null,
                      Awaited<ReturnType<typeof getCurrentUser>>,
                    ];
                  });
                recordTiming("session", sessionDurationMs);
                const [accessToken, user] = session;

                if (
                  options.forwardUserSupabaseAuth &&
                  (!accessToken || !user)
                ) {
                  return {
                    response: NextResponse.json(
                      {
                        error: "Unauthorized",
                      },
                      {
                        status: 401,
                      },
                    ),
                  };
                }

                return {
                  authContext: {
                    accessToken: accessToken ?? undefined,
                    profileId: PROFILELESS_PROFILE_ID,
                    userId: user?.id,
                  },
                };
              }

              const { durationMs: userDurationMs, result: user } =
                await measure(() => getCurrentUser());
              recordTiming("user", userDurationMs);

              if (!user) {
                return {
                  response: NextResponse.json(
                    {
                      error: "Unauthorized",
                    },
                    {
                      status: 401,
                    },
                  ),
                };
              }

              const { durationMs: profileDurationMs, result: profileId } =
                await measure(() =>
                  maybeResolveOwnedProfileId(user.id, requestedProfileId),
                );
              recordTiming("profile", profileDurationMs);
              const { durationMs: sessionDurationMs, result: accessToken } =
                await measure(() =>
                  options.forwardUserSupabaseAuth
                    ? getCurrentSupabaseAccessToken()
                    : undefined,
                );
              recordTiming("session", sessionDurationMs);

              if (options.forwardUserSupabaseAuth && !accessToken) {
                return {
                  response: NextResponse.json(
                    {
                      error: "Unauthorized",
                    },
                    {
                      status: 401,
                    },
                  ),
                };
              }

              return {
                authContext: {
                  accessToken: accessToken ?? undefined,
                  profileId,
                  userId: user.id,
                },
              };
            });

          if (authResolution.response) {
            return {
              finalize: false,
              response: authResolution.response,
            };
          }

          authContext = authResolution.authContext;
          recordTiming("auth", authDurationMs);
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
            forwardedReq.headers.set(
              "x-marble-auth-user-id",
              authContext.userId,
            );
          }

          if (authContext.accessToken) {
            forwardedReq.headers.set(
              "Authorization",
              `Bearer ${authContext.accessToken}`,
            );
          }
        }

        const { durationMs: apiDurationMs, result: apiResponse } =
          await measure(() => options.api.fetch(forwardedReq));
        recordTiming("api", apiDurationMs);

        return {
          finalize: true,
          response: new Response(apiResponse.body, apiResponse),
        };
      },
    );

  const response = forwardingResult.response;

  if (!forwardingResult.finalize) {
    return response;
  }

  recordTiming("total", totalDurationMs);

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
      authType: apiKeyToken ? "api-key" : "user-session",
      path: url.pathname,
      profileless: profilelessPath,
      requestId,
      timings,
    });
  }

  return response;
};
