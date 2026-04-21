import { NextResponse } from "next/server";
import {
  clampSidebarWidth,
  parseSidebarTreeState,
  SIDEBAR_MODE_COOKIE_NAME,
  SIDEBAR_TREE_STATE_COOKIE_NAME,
  SIDEBAR_WIDTH_COOKIE_NAME,
  serializeSidebarTreeState,
} from "../../../../lib/gui-sidebar";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    mode?: string;
    treeState?: unknown;
    width?: number;
  };

  const response = NextResponse.json({
    ok: true,
  });

  if (body.mode === "collapsed" || body.mode === "expanded") {
    response.cookies.set(SIDEBAR_MODE_COOKIE_NAME, body.mode, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  }

  if (body.treeState !== undefined) {
    response.cookies.set(
      SIDEBAR_TREE_STATE_COOKIE_NAME,
      serializeSidebarTreeState(
        parseSidebarTreeState(JSON.stringify(body.treeState)),
      ),
      {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
      },
    );
  }

  if (typeof body.width === "number" && Number.isFinite(body.width)) {
    response.cookies.set(
      SIDEBAR_WIDTH_COOKIE_NAME,
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
