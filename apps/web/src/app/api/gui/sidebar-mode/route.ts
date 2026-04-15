import { NextResponse } from "next/server";
import { clampSidebarWidth } from "../../../../lib/gui-sidebar";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    mode?: string;
    width?: number;
  };

  const response = NextResponse.json({
    ok: true,
  });

  if (body.mode === "collapsed" || body.mode === "expanded") {
    response.cookies.set("gui-sidebar-mode", body.mode, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  }

  if (typeof body.width === "number" && Number.isFinite(body.width)) {
    response.cookies.set(
      "gui-sidebar-width",
      `${clampSidebarWidth(body.width)}`,
      {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
      },
    );
  }

  return response;
}
