import app from "@marble/api";
import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { getCurrentUser } from "../../../lib/auth";
import {
  createServiceRoleClient,
  resolveOwnedProfileId,
} from "../../../lib/supabase/service-role";

async function forward(req: Request) {
  const apiKeyToken = getApiKeyTokenFromHeaders(req.headers);
  let authContext: {
    keyId?: string;
    profileId: string;
  } | null = null;

  if (apiKeyToken) {
    const keyAuth = await resolveApiKeyAuth(
      createServiceRoleClient(),
      apiKeyToken,
    );

    if (!keyAuth) {
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

    authContext = {
      profileId: await resolveOwnedProfileId(user.id),
    };
  }

  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";

  const forwardedReq = new Request(url, req);

  if (authContext) {
    forwardedReq.headers.delete("Authorization");
    forwardedReq.headers.delete("authorization");
    forwardedReq.headers.delete("x-api-key");
    forwardedReq.headers.set("x-marble-actor-source", "webapp");

    if (authContext.keyId) {
      forwardedReq.headers.set("x-marble-auth-key-id", authContext.keyId);
    }

    forwardedReq.headers.set("x-marble-auth-profile-id", authContext.profileId);
  }

  return app.fetch(forwardedReq, {
    SUPABASE_URL: env.SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || "",
    MARBLE_EXECUTOR_URL: env.MARBLE_EXECUTOR_URL || env.EXECUTOR_URL,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
