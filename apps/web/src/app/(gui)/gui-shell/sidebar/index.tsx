import { cx } from "@marble/ui";
import type {
  KeyboardEventHandler,
  PointerEventHandler,
  ReactNode,
  RefObject,
} from "react";
import type { SidebarMode } from "../../../../lib/gui-sidebar";
import type {
  SidebarTreeData,
  SidebarTreeNode,
} from "../../../../lib/sidebar-tree";
import {
  type ChangeTargetDescriptor,
  changeTargetKey,
} from "../../change-spotlight";
import { SidebarNavRow } from "../nav-row";
import { navigationGroups, utilityRoutes } from "../navigation";
import { getNodeIcon, getNodeTargetKey } from "../nodes";
import { isNodePathActive } from "../pathname";
import type { TreeCollectionKey } from "../types";
import { SidebarAccount } from "./account";
import { SidebarResizeHandle } from "./resize-handle";
import type { SidebarChrome } from "./types";

type GuiNavigationSidebarProps = {
  effectiveOpenKeys: Set<string>;
  isResizing: boolean;
  onHelpSelect: () => void;
  onResizeCancel: PointerEventHandler<HTMLHRElement>;
  onResizeKeyDown: KeyboardEventHandler<HTMLHRElement>;
  onResizeMove: PointerEventHandler<HTMLHRElement>;
  onResizeStart: PointerEventHandler<HTMLHRElement>;
  onResizeUp: PointerEventHandler<HTMLHRElement>;
  onToggleOpen: (key: string) => void;
  onToggleSidebar: () => void;
  pathname: string;
  previewDescriptors: ChangeTargetDescriptor[];
  previewTargetKeySet: Set<string>;
  resizeHandleRef: RefObject<HTMLHRElement | null>;
  selectedProgramId: string | null;
  sidebar: SidebarChrome;
  sidebarData: SidebarTreeData;
  sidebarMode: SidebarMode;
  sidebarWidth: number;
  topLevelPath: string;
  userAvatarUrl: string | null;
  userDisplayName: string;
  userEmail: string | null;
};

export const GuiNavigationSidebar = ({
  effectiveOpenKeys,
  isResizing,
  onHelpSelect,
  onResizeCancel,
  onResizeKeyDown,
  onResizeMove,
  onResizeStart,
  onResizeUp,
  onToggleOpen,
  onToggleSidebar,
  pathname,
  previewDescriptors,
  previewTargetKeySet,
  resizeHandleRef,
  selectedProgramId,
  sidebar,
  sidebarData,
  sidebarMode,
  sidebarWidth,
  topLevelPath,
  userAvatarUrl,
  userDisplayName,
  userEmail,
}: GuiNavigationSidebarProps) => {
  const ToggleIcon = sidebar.toggleIcon;
  const isNodeActive = (node: SidebarTreeNode) =>
    node.kind === "program"
      ? pathname === "/programs" && selectedProgramId === node.id
      : isNodePathActive(pathname, node.href);
  const getNodePreviewTone = (
    node: SidebarTreeNode,
  ): "ancestor" | "direct" | null => {
    if (previewTargetKeySet.has(getNodeTargetKey(node))) {
      return "direct";
    }

    if (node.children.some((child) => getNodePreviewTone(child) !== null)) {
      return "ancestor";
    }

    return null;
  };
  const getSectionPreviewTone = (
    sectionId: "profiles" | TreeCollectionKey,
  ): "ancestor" | "direct" | null => {
    if (sectionId === "profiles") {
      return previewTargetKeySet.has(changeTargetKey.profiles())
        ? "direct"
        : null;
    }

    const kinds =
      sectionId === "projects"
        ? [
            "cell",
            "column",
            "pipe",
            "project",
            "row",
            "source",
            "table",
          ]
        : [
            "program",
            "program-file",
            "program-version",
          ];

    return previewDescriptors.some((descriptor) =>
      kinds.includes(descriptor.kind),
    )
      ? "ancestor"
      : null;
  };
  const renderTree = (nodes: SidebarTreeNode[]): ReactNode =>
    nodes.map((node) => {
      const nodeKey = `node:${node.id}`;
      const isOpen = effectiveOpenKeys.has(nodeKey);
      const expandable = !sidebar.iconOnly && node.children.length > 0;

      return (
        <div
          className="flex w-full flex-col gap-1"
          key={node.id}
        >
          <SidebarNavRow
            active={isNodeActive(node)}
            expandable={expandable}
            expanded={isOpen}
            href={node.href}
            icon={getNodeIcon(node)}
            iconOnly={sidebar.iconOnly}
            label={node.label}
            onToggle={() => onToggleOpen(nodeKey)}
            previewTone={getNodePreviewTone(node)}
            targetKey={getNodeTargetKey(node)}
            title={sidebar.iconOnly ? node.label : undefined}
          />

          {expandable && isOpen ? (
            <div className="ml-2 flex flex-col gap-1 border-l border-taupe-200/80 pl-2">
              {renderTree(node.children)}
            </div>
          ) : null}
        </div>
      );
    });

  return (
    <div className="relative min-h-0">
      <aside
        className={cx(
          "flex size-full min-h-0 h-screen flex-col overflow-y-scroll pt-6 transition-[padding] duration-200 ease-out",
          sidebar.asideClassName,
        )}
        id="gui-navigation-sidebar"
      >
        <div className="flex w-full flex-col gap-2">
          <div
            className={cx("flex w-full items-center", sidebar.brandClassName)}
          >
            <SidebarAccount
              sidebar={sidebar}
              userAvatarUrl={userAvatarUrl}
              userDisplayName={userDisplayName}
              userEmail={userEmail}
            />

            {sidebar.iconOnly ? null : (
              <button
                aria-label={sidebar.toggleLabel}
                className="flex size-8 items-center justify-center rounded-md text-taupe-500 transition-colors hover:bg-taupe-200 hover:text-taupe-800"
                onClick={onToggleSidebar}
                title={sidebar.toggleLabel}
                type="button"
              >
                <ToggleIcon
                  size={16}
                  weight="bold"
                />
              </button>
            )}
          </div>
        </div>

        <nav
          aria-label="Primary"
          className={cx(
            "flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto pb-6",
            sidebar.navClassName,
          )}
        >
          {navigationGroups.map((group) => (
            <div
              className="flex w-full flex-col gap-1"
              key={group.name}
            >
              {sidebar.iconOnly ? null : (
                <span className="mb-1 px-2 font-medium text-sm tracking-tight">
                  {group.name}
                </span>
              )}
              {group.routes.map((route) => {
                const isActive = topLevelPath === route.path;
                const sectionKey = `section:${route.id}`;
                const treeKey = route.id as TreeCollectionKey;
                const nodes = route.isTree ? sidebarData[treeKey] : [];
                const isOpen = effectiveOpenKeys.has(sectionKey);
                const previewTone =
                  route.id === "projects" ||
                  route.id === "programs" ||
                  route.id === "profiles"
                    ? getSectionPreviewTone(route.id)
                    : null;

                return (
                  <div
                    className="flex w-full flex-col gap-1"
                    key={route.name}
                  >
                    <SidebarNavRow
                      active={isActive}
                      expandable={route.isTree && !sidebar.iconOnly}
                      expanded={isOpen}
                      href={route.path}
                      icon={route.icon}
                      iconOnly={sidebar.iconOnly}
                      label={route.name}
                      onToggle={() => onToggleOpen(sectionKey)}
                      previewTone={previewTone}
                      targetKey={
                        route.id === "profiles"
                          ? changeTargetKey.profiles()
                          : undefined
                      }
                      title={sidebar.iconOnly ? route.name : undefined}
                    />

                    {route.isTree && !sidebar.iconOnly && isOpen ? (
                      <div className="ml-2 flex flex-col gap-1 border-l border-taupe-200/80 pl-2">
                        {renderTree(nodes)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}

          <div className="mt-auto mb-12 flex w-full flex-col gap-1">
            {utilityRoutes.map((route) => (
              <SidebarNavRow
                active={topLevelPath === route.path}
                href={route.path}
                icon={route.icon}
                iconOnly={sidebar.iconOnly}
                key={route.name}
                label={route.name}
                onSelect={route.name === "Help" ? onHelpSelect : undefined}
                title={sidebar.iconOnly ? route.name : undefined}
              />
            ))}
          </div>
        </nav>
      </aside>

      {sidebarMode === "collapsed" ? (
        <button
          aria-label={sidebar.toggleLabel}
          className="absolute top-[4rem] -right-2 z-20 flex size-7 translate-x-1/2 items-center justify-center rounded-full border border-taupe-300/80 bg-white/95 text-taupe-500 shadow-[0_8px_18px_rgba(84,57,26,0.14)] transition-[background-color,color,box-shadow,transform] hover:bg-white hover:text-taupe-900 hover:shadow-[0_12px_24px_rgba(84,57,26,0.18)]"
          onClick={onToggleSidebar}
          title={sidebar.toggleLabel}
          type="button"
        >
          <ToggleIcon
            size={14}
            weight="bold"
          />
        </button>
      ) : null}

      {sidebarMode === "collapsed" ? null : (
        <SidebarResizeHandle
          isResizing={isResizing}
          onResizeCancel={onResizeCancel}
          onResizeKeyDown={onResizeKeyDown}
          onResizeMove={onResizeMove}
          onResizeStart={onResizeStart}
          onResizeUp={onResizeUp}
          resizeHandleRef={resizeHandleRef}
          sidebarWidth={sidebarWidth}
        />
      )}
    </div>
  );
};
