import app from "@marble/api";
import { createClient } from "@marble/supabase";
import { NextResponse } from "next/server";
import { env } from "@/env";
import {
  getApiKeyTokenFromHeaders,
  resolveApiKeyAuth,
} from "../../../../../../packages/keys/src/index";
import { getCurrentUser } from "../../../lib/auth";

async function forward(req: Request) {
  const apiKeyToken = getApiKeyTokenFromHeaders(req.headers);
  let isAuthenticated = false;
  let keyAuth: Awaited<ReturnType<typeof resolveApiKeyAuth>> | null = null;
  let isApiKeyAuth = false;

  if (apiKeyToken) {
    if (env.MARBLE_API_KEY && apiKeyToken === env.MARBLE_API_KEY) {
      isAuthenticated = true;
      isApiKeyAuth = true;
    } else {
      const supabase = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
      );
      keyAuth = await resolveApiKeyAuth(supabase, apiKeyToken);

      if (keyAuth) {
        isAuthenticated = true;
        isApiKeyAuth = true;
      }
    }
  }

  if (!isAuthenticated) {
    const user = await getCurrentUser();
    if (user) {
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";

  const forwardedReq = new Request(url, req);

  if (isApiKeyAuth) {
    forwardedReq.headers.delete("Authorization");
    forwardedReq.headers.delete("authorization");
    forwardedReq.headers.delete("x-api-key");

    if (keyAuth) {
      forwardedReq.headers.set("x-marble-auth-key-id", keyAuth.id);
      forwardedReq.headers.set(
        "x-marble-auth-profile-id",
        keyAuth.owner_profile_id,
      );
    }
  }

  return app.fetch(forwardedReq, {
    SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || "",
    MARBLE_EXECUTOR_URL: env.MARBLE_EXECUTOR_URL || env.EXECUTOR_URL,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
