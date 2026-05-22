import {
  cx,
  MarbleTabs,
  MarbleTabsContent,
  MarbleTabsList,
  MarbleTabsTrigger,
} from "@marble/ui";
import { XIcon } from "@phosphor-icons/react";
import type {
  KeyboardEventHandler,
  PointerEventHandler,
  RefObject,
} from "react";
import {
  MAX_AGENT_SIDEBAR_WIDTH,
  MIN_AGENT_SIDEBAR_WIDTH,
  type SidebarMode,
} from "../../../lib/gui-sidebar";
import type { SidebarTreeData } from "../../../lib/sidebar-tree";
import { AgentChat } from "../agent-chat";
import { ChangeRadar } from "../change-radar";

type GuiAgentSidebarProps = {
  agentSidebarMode: SidebarMode;
  agentSidebarTab: "changes" | "chat";
  agentSidebarToggleLabel: string;
  agentSidebarWidth: number;
  isAgentSidebarResizing: boolean;
  onAgentSidebarTabChange: (value: string) => void;
  onResizeCancel: PointerEventHandler<HTMLHRElement>;
  onResizeKeyDown: KeyboardEventHandler<HTMLHRElement>;
  onResizeMove: PointerEventHandler<HTMLHRElement>;
  onResizeStart: PointerEventHandler<HTMLHRElement>;
  onResizeUp: PointerEventHandler<HTMLHRElement>;
  onToggleAgentSidebar: () => void;
  resizeHandleRef: RefObject<HTMLHRElement | null>;
  sidebarData: SidebarTreeData;
};

export const GuiAgentSidebar = ({
  agentSidebarMode,
  agentSidebarTab,
  agentSidebarToggleLabel,
  agentSidebarWidth,
  isAgentSidebarResizing,
  onAgentSidebarTabChange,
  onResizeCancel,
  onResizeKeyDown,
  onResizeMove,
  onResizeStart,
  onResizeUp,
  onToggleAgentSidebar,
  resizeHandleRef,
  sidebarData,
}: GuiAgentSidebarProps) => (
  <>
    <div
      className={cx(
        "relative min-h-0",
        agentSidebarMode === "collapsed"
          ? null
          : "h-screen border-l border-taupe-200/90 bg-linear-to-b from-taupe-100/95 to-white/95",
      )}
    >
      {agentSidebarMode === "collapsed" ? null : (
        <aside
          className="flex size-full min-h-0 h-screen flex-col overflow-hidden"
          id="gui-agent-sidebar"
        >
          <MarbleTabs
            className="flex min-h-0 flex-1 flex-col gap-0"
            onValueChange={onAgentSidebarTabChange}
            value={agentSidebarTab}
            variant="quiet"
          >
            <div className="flex items-center gap-1 px-3 pt-2">
              <MarbleTabsList className="flex-1">
                <MarbleTabsTrigger value="chat">Chat</MarbleTabsTrigger>
                <MarbleTabsTrigger value="changes">Changes</MarbleTabsTrigger>
              </MarbleTabsList>
              <button
                aria-label={agentSidebarToggleLabel}
                className="flex size-7 shrink-0 items-center justify-center rounded-sm text-taupe-400 transition-colors hover:bg-taupe-100 hover:text-taupe-700"
                onClick={onToggleAgentSidebar}
                title={agentSidebarToggleLabel}
                type="button"
              >
                <XIcon
                  size={14}
                  weight="bold"
                />
              </button>
            </div>
            <MarbleTabsContent
              className="min-h-0 flex-1 overflow-hidden"
              value="chat"
            >
              <AgentChat />
            </MarbleTabsContent>
            <MarbleTabsContent
              className="min-h-0 flex-1 overflow-hidden"
              value="changes"
            >
              <ChangeRadar
                className="min-h-0 size-full rounded-none border-0 bg-transparent shadow-none"
                sidebarData={sidebarData}
              />
            </MarbleTabsContent>
          </MarbleTabs>
        </aside>
      )}

      {agentSidebarMode === "collapsed" ? null : (
        <hr
          aria-controls="gui-agent-sidebar"
          aria-label="Resize agent sidebar"
          aria-orientation="vertical"
          aria-valuemax={MAX_AGENT_SIDEBAR_WIDTH}
          aria-valuemin={MIN_AGENT_SIDEBAR_WIDTH}
          aria-valuenow={agentSidebarWidth}
          className={cx(
            "absolute top-0 left-0 z-10 h-full w-3 -translate-x-1/2 cursor-col-resize touch-none border-0 bg-linear-to-r from-transparent via-transparent to-transparent transition-colors",
            isAgentSidebarResizing
              ? "via-taupe-400"
              : "hover:via-taupe-300 focus-visible:via-taupe-300",
          )}
          onKeyDown={onResizeKeyDown}
          onPointerCancel={onResizeCancel}
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          ref={resizeHandleRef}
          tabIndex={0}
          title="Resize agent sidebar"
        />
      )}
    </div>

    {agentSidebarMode === "collapsed" ? (
      <div className="pointer-events-none absolute right-2 bottom-2 z-20">
        <ChangeRadar
          className="pointer-events-auto shrink-0 opacity-80 transition-opacity hover:opacity-100"
          mode="trigger"
          onToggleSidebar={onToggleAgentSidebar}
          sidebarData={sidebarData}
        />
      </div>
    ) : null}
  </>
);
