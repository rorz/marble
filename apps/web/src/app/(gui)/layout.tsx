import { cookies } from "next/headers";
import { requireUser } from "../../lib/auth";
import { GuiShell } from "./gui-shell";

export default async function GuiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  const cookieStore = await cookies();
  const initialSidebarMode =
    cookieStore.get("gui-sidebar-mode")?.value === "collapsed"
      ? "collapsed"
      : "expanded";

  return (
    <GuiShell initialSidebarMode={initialSidebarMode}>{children}</GuiShell>
  );
}
