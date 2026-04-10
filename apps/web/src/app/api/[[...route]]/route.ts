import app from "@marble/api";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { getCurrentUser } from "../../../lib/auth";

async function forward(req: Request) {
  // Check for an API key in the Authorization header
  const authHeader = req.headers.get("Authorization");
  let isAuthenticated = false;
  let isApiKeyAuth = false;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (env.MARBLE_API_KEY && token === env.MARBLE_API_KEY) {
      isAuthenticated = true;
      isApiKeyAuth = true;
    }
  }

  // If no valid API key, check for a session
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

  // If authenticated via the static API key, do not forward the static key
  // to the Supabase client as an Authorization header (it expects a valid JWT).
  if (isApiKeyAuth) {
    forwardedReq.headers.delete("Authorization");
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
export const DELETE = forward;
