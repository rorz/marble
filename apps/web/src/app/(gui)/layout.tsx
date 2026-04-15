import { cookies } from "next/headers";
import { requireUser } from "../../lib/auth";
import { parseSidebarWidth } from "../../lib/gui-sidebar";
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
    cookieStore.get("gui-sidebar-mode")?.value === "collapsed"
      ? "collapsed"
      : "expanded";
  const initialSidebarWidth = parseSidebarWidth(
    cookieStore.get("gui-sidebar-width")?.value,
  );

  return (
    <GuiShell
      initialSidebarData={initialSidebarData}
      initialSidebarMode={initialSidebarMode}
      initialSidebarWidth={initialSidebarWidth}
    >
      {children}
    </GuiShell>
  );
}
