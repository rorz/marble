import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    mode?: string;
  };
  const mode = body.mode === "collapsed" ? "collapsed" : "expanded";

  const response = NextResponse.json({
    ok: true,
  });

  response.cookies.set("gui-sidebar-mode", mode, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
