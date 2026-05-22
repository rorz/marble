"use client";

import { cx } from "@marble/ui";
import { usePathname, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useMemo,
} from "react";
import type { SidebarMode, SidebarTreeState } from "../../../lib/gui-sidebar";
import { useMarbleWebSessionSdk } from "../../../lib/marble-sdk-client";
import { useBroadcastResync } from "../../../lib/realtime/broadcast-resync";
import { usePrivateBroadcast } from "../../../lib/realtime/private-broadcast";
import { buildSidebarTreeData } from "../../../lib/sidebar-snapshot";
import {
  applySidebarMutation,
  isSidebarMutation,
} from "../../../lib/sidebar-sync";
import type { SidebarTreeData } from "../../../lib/sidebar-tree";
import { AgentChatCue, AgentChatProvider } from "../agent-chat";
import {
  ChangeSpotlight,
  parseChangeTargetKey,
  useChangeSpotlightPreviewTargetKeys,
} from "../change-spotlight";
import { buildAgentPageContext } from "./agent-context";
import { GuiAgentSidebar } from "./agent-sidebar";
import { useGuiCommandPalette } from "./command-palette";
import {
  GUI_SIDEBAR_FIRST_PARTY_PROGRAMS_TOPIC,
  guiSidebarUserTopic,
} from "./constants";
import { GuiNavigationSidebar } from "./sidebar";
import { useSidebarLayout } from "./use-sidebar-layout";
import { useSidebarTree } from "./use-sidebar-tree";

export const GuiShell = ({
  children,
  initialAgentSidebarMode,
  initialAgentSidebarWidth,
  initialSidebarData,
  initialSidebarMode,
  initialSidebarTreeState,
  initialSidebarWidth,
  userAvatarUrl,
  userDisplayName,
  userEmail,
  userId,
}: {
  children: ReactNode;
  initialAgentSidebarMode: SidebarMode;
  initialAgentSidebarWidth: number;
  initialSidebarData: SidebarTreeData;
  initialSidebarMode: SidebarMode;
  initialSidebarTreeState: SidebarTreeState;
  initialSidebarWidth: number;
  userAvatarUrl: string | null;
  userDisplayName: string;
  userEmail: string | null;
  userId: string;
}) => {
  const {
    agentResizeHandleRef,
    agentSidebarMode,
    agentSidebarTab,
    agentSidebarToggleLabel,
    agentSidebarWidth,
    finishAgentSidebarResize,
    finishResize,
    handleAgentSidebarResizeKeyDown,
    handleAgentSidebarResizeMove,
    handleAgentSidebarResizeStart,
    handleAgentSidebarTabChange,
    handleResizeKeyDown,
    handleResizeMove,
    handleResizeStart,
    isAgentSidebarResizing,
    isAnySidebarResizing,
    isResizing,
    layoutGridColumns,
    openAgentChat,
    resizeHandleRef,
    sidebar,
    sidebarMode,
    sidebarWidth,
    toggleAgentSidebar,
    toggleSidebar,
  } = useSidebarLayout({
    initialAgentSidebarMode,
    initialAgentSidebarWidth,
    initialSidebarMode,
    initialSidebarWidth,
  });
  const apiSdk = useMarbleWebSessionSdk();
  const fetchSidebarSnapshot = useCallback(async () => {
    const snapshot = await apiSdk.sidebar.getData({});
    return buildSidebarTreeData(snapshot);
  }, [
    apiSdk,
  ]);
  const {
    applyBroadcast: applySidebarBroadcast,
    resync: resyncSidebar,
    state: sidebarData,
  } = useBroadcastResync({
    applyMutation: applySidebarMutation,
    fetchSnapshot: fetchSidebarSnapshot,
    initialState: initialSidebarData,
    isMutation: isSidebarMutation,
    label: "GUI sidebar",
  });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewTargetKeys = useChangeSpotlightPreviewTargetKeys();
  const topLevelPath = `/${pathname.split("/").at(1)}`;
  const selectedProgramId = searchParams.get("programId");
  const agentPageContext = useMemo(
    () =>
      buildAgentPageContext({
        pathname,
        search: searchParams.toString(),
        selectedProgramId,
        sidebarData,
      }),
    [
      pathname,
      searchParams,
      selectedProgramId,
      sidebarData,
    ],
  );
  const previewTargetKeySet = useMemo(
    () => new Set(previewTargetKeys),
    [
      previewTargetKeys,
    ],
  );
  const previewDescriptors = useMemo(
    () =>
      previewTargetKeys
        .map((targetKey) => parseChangeTargetKey(targetKey))
        .filter((descriptor): descriptor is NonNullable<typeof descriptor> =>
          Boolean(descriptor),
        ),
    [
      previewTargetKeys,
    ],
  );
  const { effectiveOpenKeys, toggleOpen } = useSidebarTree({
    initialSidebarTreeState,
    pathname,
    previewDescriptors,
    selectedProgramId,
    sidebarData,
    sidebarMode,
  });
  const { commandPaletteNode, isCommandPaletteActive, openHelpCommandPalette } =
    useGuiCommandPalette({
      pathname,
      sidebarData,
    });
  usePrivateBroadcast({
    event: "sidebar_mutation",
    label: "GUI sidebar",
    onMessage: applySidebarBroadcast,
    onSubscribed: resyncSidebar,
    topic: guiSidebarUserTopic(userId),
  });
  usePrivateBroadcast({
    event: "sidebar_mutation",
    label: "GUI sidebar",
    onMessage: applySidebarBroadcast,
    onSubscribed: resyncSidebar,
    topic: GUI_SIDEBAR_FIRST_PARTY_PROGRAMS_TOPIC,
  });

  return (
    <AgentChatProvider pageContext={agentPageContext}>
      <div
        className={cx(
          "relative grid h-screen grid-cols-1 grid-rows-1 bg-taupe-100 md:[grid-template-columns:var(--gui-sidebar-columns)]",
          isAnySidebarResizing
            ? ""
            : "transition-[grid-template-columns] duration-200 ease-out",
        )}
        style={
          {
            "--gui-sidebar-columns": layoutGridColumns,
          } as CSSProperties
        }
      >
        <GuiNavigationSidebar
          effectiveOpenKeys={effectiveOpenKeys}
          isResizing={isResizing}
          onHelpSelect={openHelpCommandPalette}
          onResizeCancel={finishResize}
          onResizeKeyDown={handleResizeKeyDown}
          onResizeMove={handleResizeMove}
          onResizeStart={handleResizeStart}
          onResizeUp={finishResize}
          onToggleOpen={toggleOpen}
          onToggleSidebar={toggleSidebar}
          pathname={pathname}
          previewDescriptors={previewDescriptors}
          previewTargetKeySet={previewTargetKeySet}
          resizeHandleRef={resizeHandleRef}
          selectedProgramId={selectedProgramId}
          sidebar={sidebar}
          sidebarData={sidebarData}
          sidebarMode={sidebarMode}
          sidebarWidth={sidebarWidth}
          topLevelPath={topLevelPath}
          userAvatarUrl={userAvatarUrl}
          userDisplayName={userDisplayName}
          userEmail={userEmail}
        />

        <main className="bg-transparent p-2 pb-8">
          <div className="size-full overflow-hidden rounded-md border border-taupe-200 bg-taupe-50 shadow-md">
            {children}
          </div>
        </main>

        <GuiAgentSidebar
          agentSidebarMode={agentSidebarMode}
          agentSidebarTab={agentSidebarTab}
          agentSidebarToggleLabel={agentSidebarToggleLabel}
          agentSidebarWidth={agentSidebarWidth}
          isAgentSidebarResizing={isAgentSidebarResizing}
          onAgentSidebarTabChange={handleAgentSidebarTabChange}
          onResizeCancel={finishAgentSidebarResize}
          onResizeKeyDown={handleAgentSidebarResizeKeyDown}
          onResizeMove={handleAgentSidebarResizeMove}
          onResizeStart={handleAgentSidebarResizeStart}
          onResizeUp={finishAgentSidebarResize}
          onToggleAgentSidebar={toggleAgentSidebar}
          resizeHandleRef={agentResizeHandleRef}
          sidebarData={sidebarData}
        />

        <ChangeSpotlight />

        <AgentChatCue
          disabled={isCommandPaletteActive}
          onSubmitStart={openAgentChat}
        />

        {commandPaletteNode}
      </div>
    </AgentChatProvider>
  );
};
