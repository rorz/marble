import app from "@marble/api";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { getCurrentUser } from "../../../lib/auth";

async function forward(req: Request) {
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

  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";

  const forwardedReq = new Request(url, req);
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
