import { cookies } from "next/headers";
import { requireUser } from "../../lib/auth";
import {
  parseSidebarTreeState,
  parseSidebarWidth,
  SIDEBAR_MODE_COOKIE_NAME,
  SIDEBAR_TREE_STATE_COOKIE_NAME,
  SIDEBAR_WIDTH_COOKIE_NAME,
} from "../../lib/gui-sidebar";
import { listSidebarDataForUser } from "../../lib/sidebar-data";
import { GuiShell } from "./gui-shell";

export default async function GuiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const [cookieStore, initialSidebarData] = await Promise.all([
    cookies(),
    listSidebarDataForUser(user.id),
  ]);
  const initialSidebarMode =
    cookieStore.get(SIDEBAR_MODE_COOKIE_NAME)?.value === "collapsed"
      ? "collapsed"
      : "expanded";
  const initialSidebarTreeState = parseSidebarTreeState(
    cookieStore.get(SIDEBAR_TREE_STATE_COOKIE_NAME)?.value,
  );
  const initialSidebarWidth = parseSidebarWidth(
    cookieStore.get(SIDEBAR_WIDTH_COOKIE_NAME)?.value,
  );

  return (
    <GuiShell
      initialSidebarData={initialSidebarData}
      initialSidebarMode={initialSidebarMode}
      initialSidebarTreeState={initialSidebarTreeState}
      initialSidebarWidth={initialSidebarWidth}
    >
      {children}
    </GuiShell>
  );
}
