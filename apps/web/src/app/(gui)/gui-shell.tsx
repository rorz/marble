"use client";

import type { Database } from "@marble/supabase";
import {
  cx,
  MarbleCommandDialog,
  MarbleCommandEmpty,
  MarbleCommandGroup,
  MarbleCommandInput,
  MarbleCommandItem,
  MarbleCommandList,
  MarbleCommandSeparator,
  MarbleWorkspacePopover,
} from "@marble/ui";
import {
  BookOpenTextIcon,
  BriefcaseMetalIcon,
  type CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretDownIcon,
  CaretRightIcon,
  CodeBlockIcon,
  FileCodeIcon,
  IdentificationBadgeIcon,
  LifebuoyIcon,
  PlugsIcon,
  RobotIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react";
import { SidebarIcon, TableIcon } from "@phosphor-icons/react/dist/ssr";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  COLLAPSED_SIDEBAR_WIDTH,
  clampSidebarWidth,
  type SidebarMode,
} from "../../lib/gui-sidebar";
import type { RealtimePayload } from "../../lib/realtime-crud";
import {
  applySidebarMutation,
  type SidebarMutation,
} from "../../lib/sidebar-sync";
import {
  collectActiveSidebarKeys,
  type SidebarTreeData,
  type SidebarTreeNode,
} from "../../lib/sidebar-tree";
import { createClient } from "../../lib/supabase/browser";
import { useSignOut } from "../sign-out-button";

type TreeCollectionKey = "programs" | "projects";
type SidebarGroup = {
  name: string;
  routes: {
    icon: ReactNode;
    id: string;
    isTree?: boolean;
    name: string;
    path: `/${string}`;
  }[];
}[];

const navigationGroups: SidebarGroup = [
  {
    name: "Workspace",
    routes: [
      {
        icon: (
          <BriefcaseMetalIcon
            size={20}
            weight="regular"
          />
        ),
        id: "projects",
        isTree: true,
        name: "Projects",
        path: "/projects",
      },
      {
        icon: (
          <TreeStructureIcon
            size={20}
            weight="regular"
          />
        ),
        id: "sources",
        name: "Sources",
        path: "/sources",
      },
      {
        icon: (
          <FileCodeIcon
            size={20}
            weight="regular"
          />
        ),
        id: "programs",
        isTree: true,
        name: "Programs",
        path: "/programs",
      },
      {
        icon: (
          <PlugsIcon
            size={20}
            weight="regular"
          />
        ),
        id: "integrations",
        name: "Integrations",
        path: "/integrations",
      },
    ],
  },
  {
    name: "Agentic use",
    routes: [
      {
        icon: (
          <IdentificationBadgeIcon
            size={20}
            weight="regular"
          />
        ),
        id: "profiles",
        name: "Profiles",
        path: "/profiles",
      },
      {
        icon: (
          <RobotIcon
            size={20}
            weight="regular"
          />
        ),
        id: "automations",
        name: "Automations",
        path: "/automations",
      },
    ],
  },
] as const;

const utilityRoutes: {
  icon: ReactNode;
  name: string;
  path: `/${string}`;
}[] = [
  {
    icon: <BookOpenTextIcon weight="bold" />,
    name: "Events",
    path: "/events",
  },
  {
    icon: <LifebuoyIcon weight="bold" />,
    name: "Help",
    path: "/help",
  },
];

type ProjectRow = Database["public"]["Tables"]["project"]["Row"];
type ProgramRow = Database["public"]["Tables"]["program"]["Row"];
type TableRow = Database["public"]["Tables"]["table"]["Row"];
type CommandPaletteItem = {
  detail: string;
  icon: ReactNode;
  id: string;
  keywords: string[];
  label: string;
  onSelect: () => void;
};
type CommandPaletteSection = {
  heading: string;
  id: string;
  items: CommandPaletteItem[];
};

const sidebarModes = {
  collapsed: {
    asideClassName: "items-center px-0 gap-10",
    brandClassName: "justify-center",
    brandInnerClassName: "justify-center",
    iconOnly: true,
    navClassName: "items-center",
    routeClassName: "w-auto justify-center",
    toggleIcon: CaretDoubleRightIcon,
    toggleLabel: "Expand sidebar",
  },
  expanded: {
    asideClassName: "items-start px-2 gap-8",
    brandClassName: "justify-between gap-2",
    brandInnerClassName: "gap-2",
    iconOnly: false,
    navClassName: "items-stretch",
    routeClassName: "w-full gap-1",
    toggleIcon: SidebarIcon,
    toggleLabel: "Collapse sidebar",
  },
} as const satisfies Record<
  SidebarMode,
  {
    asideClassName: string;
    brandClassName: string;
    brandInnerClassName: string;
    iconOnly: boolean;
    navClassName: string;
    routeClassName: string;
    toggleIcon: typeof CaretDoubleLeftIcon;
    toggleLabel: string;
  }
>;

const nextSidebarMode: Record<SidebarMode, SidebarMode> = {
  collapsed: "expanded",
  expanded: "collapsed",
};

function isNodePathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function collectCommandPaletteResources(
  nodes: SidebarTreeNode[],
  parents: SidebarTreeNode[] = [],
): Array<{
  node: SidebarTreeNode;
  parents: SidebarTreeNode[];
}> {
  return nodes.flatMap((node) => [
    {
      node,
      parents,
    },
    ...collectCommandPaletteResources(node.children, [
      ...parents,
      node,
    ]),
  ]);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest("[cmdk-root]")) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function getNodeIcon(node: SidebarTreeNode) {
  if (node.kind === "project") {
    return null;
  }

  if (node.kind === "table") {
    return (
      <TableIcon
        className="h-4 w-4"
        weight="duotone"
      />
    );
  }

  return (
    <CodeBlockIcon
      className="h-4 w-4"
      weight="duotone"
    />
  );
}

function SidebarNavRow({
  active = false,
  expandable = false,
  expanded = false,
  href,
  icon,
  iconOnly,
  label,
  onSelect,
  onToggle,
  title,
}: {
  active?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  href: string;
  icon: ReactNode;
  iconOnly: boolean;
  label: string;
  onSelect?: () => void;
  onToggle?: () => void;
  title?: string;
}) {
  const router = useRouter();
  const showDisclosure = expandable && !iconOnly;
  const showIconSlot = Boolean(icon);

  return (
    <div
      className={cx(
        "group flex min-w-0 items-center rounded-md text-taupe-700 transition-colors",
        active
          ? "bg-taupe-300/80 text-taupe-900"
          : "hover:bg-taupe-200/80 hover:text-taupe-900",
        iconOnly ? "w-auto justify-center" : "w-full pr-1",
      )}
    >
      <Link
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex min-w-0 flex-1 items-center",
          iconOnly ? "justify-center p-2" : "gap-1.5 px-2 py-0.5 h-7",
        )}
        href={href}
        onClick={(event) => {
          if (onSelect) {
            event.preventDefault();
            onSelect();
            return;
          }

          if (expandable && !expanded) {
            onToggle?.();
          }
        }}
        title={title}
      >
        {showIconSlot ? (
          <div className="flex size-5 shrink-0 items-center justify-center">
            {icon}
          </div>
        ) : null}
        {iconOnly ? null : (
          <span className="truncate font-medium text-sm tracking-tight">
            {label}
          </span>
        )}
      </Link>

      {showDisclosure ? (
        <button
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-sm text-current opacity-60 transition-opacity hover:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            const nextExpanded = !expanded;

            onToggle?.();

            if (!active && nextExpanded) {
              router.push(href);
            }
          }}
          type="button"
        >
          {expanded ? (
            <CaretDownIcon
              size={12}
              weight="bold"
            />
          ) : (
            <CaretRightIcon
              size={12}
              weight="bold"
            />
          )}
        </button>
      ) : null}
    </div>
  );
}

export function GuiShell({
  children,
  initialSidebarData,
  initialSidebarMode,
  initialSidebarWidth,
}: {
  children: ReactNode;
  initialSidebarData: SidebarTreeData;
  initialSidebarMode: SidebarMode;
  initialSidebarWidth: number;
}) {
  const [sidebarMode, setSidebarMode] =
    useState<SidebarMode>(initialSidebarMode);
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [sidebarData, setSidebarData] = useState(initialSidebarData);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebar = sidebarModes[sidebarMode];
  const ToggleIcon = sidebar.toggleIcon;
  const router = useRouter();
  const {
    error: signOutError,
    pending: signOutPending,
    signOut,
  } = useSignOut();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resizeHandleRef = useRef<HTMLButtonElement | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const resizeStateRef = useRef<null | {
    pointerId: number;
    startWidth: number;
    startX: number;
  }>(null);
  const topLevelPath = `/${pathname.split("/").at(1)}`;
  const selectedProgramId = searchParams.get("programId");
  const openCommandPalette = () => {
    setIsCommandPaletteOpen(true);
  };
  const navigateFromCommandPalette = (path: string) => {
    setIsCommandPaletteOpen(false);
    router.push(path);
  };
  const workspaceMenuSections = [
    {
      id: "workspace-core",
      items: [
        {
          icon: (
            <IdentificationBadgeIcon
              size={16}
              weight="regular"
            />
          ),
          id: "workspace-profiles",
          label: "Profiles",
          onSelect: () => router.push("/profiles"),
        },
        {
          icon: (
            <BriefcaseMetalIcon
              size={16}
              weight="regular"
            />
          ),
          id: "workspace-projects",
          label: "Projects",
          onSelect: () => router.push("/projects"),
        },
        {
          icon: (
            <FileCodeIcon
              size={16}
              weight="regular"
            />
          ),
          id: "workspace-programs",
          label: "Programs",
          onSelect: () => router.push("/programs"),
        },
      ],
    },
    {
      id: "workspace-tools",
      items: [
        {
          icon: (
            <PlugsIcon
              size={16}
              weight="regular"
            />
          ),
          id: "workspace-sources",
          label: "Sources",
          onSelect: () => router.push("/sources"),
        },
        {
          icon: (
            <RobotIcon
              size={16}
              weight="regular"
            />
          ),
          id: "workspace-automations",
          label: "Automations",
          onSelect: () => router.push("/automations"),
        },
        {
          icon: (
            <BookOpenTextIcon
              size={16}
              weight="regular"
            />
          ),
          id: "workspace-events",
          label: "Events",
          onSelect: () => router.push("/events"),
        },
        {
          icon: (
            <LifebuoyIcon
              size={16}
              weight="regular"
            />
          ),
          id: "workspace-help",
          label: "Help",
          onSelect: openCommandPalette,
        },
      ],
    },
    {
      id: "workspace-session",
      items: [
        {
          disabled: signOutPending,
          id: "workspace-sign-out",
          label: signOutPending ? "Signing out..." : "Sign out",
          onSelect: () => {
            void signOut();
          },
          tone: "danger" as const,
        },
      ],
    },
  ];
  const projectResources = collectCommandPaletteResources(sidebarData.projects);
  const projectCommandItems = projectResources
    .filter(({ node }) => node.kind === "project")
    .map(({ node }) => ({
      detail: "Project",
      icon: (
        <BriefcaseMetalIcon
          size={16}
          weight="regular"
        />
      ),
      id: `command-palette-project:${node.id}`,
      keywords: [
        "project",
        "workspace",
        node.id,
      ],
      label: node.label,
      onSelect: () => navigateFromCommandPalette(node.href),
    }));
  const tableCommandItems = projectResources
    .filter(({ node }) => node.kind === "table")
    .map(({ node, parents }) => {
      const parentPath = parents.map((parent) => parent.label);
      const projectLabel = parentPath.at(-1) ?? "Project";

      return {
        detail: projectLabel,
        icon: (
          <TableIcon
            className="h-4 w-4"
            weight="duotone"
          />
        ),
        id: `command-palette-table:${node.id}`,
        keywords: [
          "table",
          node.id,
          ...parentPath,
        ],
        label: node.label,
        onSelect: () => navigateFromCommandPalette(node.href),
      };
    });
  const programCommandItems = sidebarData.programs.map((node) => ({
    detail: "Program",
    icon: (
      <CodeBlockIcon
        size={16}
        weight="duotone"
      />
    ),
    id: `command-palette-program:${node.id}`,
    keywords: [
      "program",
      "code",
      "runner",
      node.id,
    ],
    label: node.label,
    onSelect: () => navigateFromCommandPalette(node.href),
  }));
  const commandPaletteSections: CommandPaletteSection[] = [
    {
      heading: "Jump to",
      id: "command-palette-navigation",
      items: [
        {
          detail: "/projects",
          icon: (
            <BriefcaseMetalIcon
              size={16}
              weight="regular"
            />
          ),
          id: "command-palette-projects",
          keywords: [
            "workspace",
            "project",
          ],
          label: "Open projects",
          onSelect: () => navigateFromCommandPalette("/projects"),
        },
        {
          detail: "/programs",
          icon: (
            <FileCodeIcon
              size={16}
              weight="regular"
            />
          ),
          id: "command-palette-programs",
          keywords: [
            "code",
            "runner",
            "program",
          ],
          label: "Open programs",
          onSelect: () => navigateFromCommandPalette("/programs"),
        },
        {
          detail: "/tables",
          icon: (
            <TableIcon
              className="h-4 w-4"
              weight="duotone"
            />
          ),
          id: "command-palette-tables",
          keywords: [
            "rows",
            "columns",
            "schema",
          ],
          label: "Open tables",
          onSelect: () => navigateFromCommandPalette("/tables"),
        },
      ],
    },
    {
      heading: "Projects",
      id: "command-palette-project-resources",
      items: projectCommandItems,
    },
    {
      heading: "Tables",
      id: "command-palette-table-resources",
      items: tableCommandItems,
    },
    {
      heading: "Programs",
      id: "command-palette-program-resources",
      items: programCommandItems,
    },
    {
      heading: "Agentic use",
      id: "command-palette-agentic",
      items: [
        {
          detail: "/profiles",
          icon: (
            <IdentificationBadgeIcon
              size={16}
              weight="regular"
            />
          ),
          id: "command-palette-profiles",
          keywords: [
            "people",
            "personas",
            "agents",
          ],
          label: "Open profiles",
          onSelect: () => navigateFromCommandPalette("/profiles"),
        },
        {
          detail: "/automations",
          icon: (
            <RobotIcon
              size={16}
              weight="regular"
            />
          ),
          id: "command-palette-automations",
          keywords: [
            "scheduled",
            "runs",
            "automation",
          ],
          label: "Open automations",
          onSelect: () => navigateFromCommandPalette("/automations"),
        },
      ],
    },
    {
      heading: "Examples",
      id: "command-palette-examples",
      items: [
        {
          detail: "/events",
          icon: (
            <BookOpenTextIcon
              size={16}
              weight="regular"
            />
          ),
          id: "command-palette-events",
          keywords: [
            "log",
            "activity",
            "feed",
          ],
          label: "Open events",
          onSelect: () => navigateFromCommandPalette("/events"),
        },
        {
          detail: "/help",
          icon: (
            <LifebuoyIcon
              size={16}
              weight="regular"
            />
          ),
          id: "command-palette-help",
          keywords: [
            "docs",
            "support",
            "examples",
          ],
          label: "Open help examples",
          onSelect: () => navigateFromCommandPalette("/help"),
        },
      ],
    },
  ].filter((section) => section.items.length > 0);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    const keys = new Set<string>(
      initialSidebarMode === "expanded"
        ? [
            "section:programs",
            "section:projects",
          ]
        : [],
    );

    const isNodeActive = (node: SidebarTreeNode) =>
      node.kind === "program"
        ? pathname === "/programs" && selectedProgramId === node.id
        : isNodePathActive(pathname, node.href);

    for (const key of collectActiveSidebarKeys(
      initialSidebarData.projects,
      isNodeActive,
    )) {
      keys.add(key);
    }

    for (const key of collectActiveSidebarKeys(
      initialSidebarData.programs,
      isNodeActive,
    )) {
      keys.add(key);
    }

    return keys;
  });
  const expandedGridColumns = `${sidebarWidth}px minmax(0, 1fr)`;

  const toggleSidebar = () => {
    const nextMode = nextSidebarMode[sidebarMode];

    void fetch("/api/gui/sidebar-mode", {
      body: JSON.stringify({
        mode: nextMode,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    setSidebarMode(nextMode);
  };

  const persistSidebarWidth = (nextWidth: number) => {
    void fetch("/api/gui/sidebar-mode", {
      body: JSON.stringify({
        width: clampSidebarWidth(nextWidth),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  };

  const toggleOpen = (key: string) => {
    setOpenKeys((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const finishResize = () => {
    const resizeState = resizeStateRef.current;

    if (!resizeState) {
      return;
    }

    resizeHandleRef.current?.releasePointerCapture(resizeState.pointerId);
    resizeStateRef.current = null;
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    persistSidebarWidth(sidebarWidthRef.current);
  };

  const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (sidebarMode === "collapsed") {
      return;
    }

    resizeStateRef.current = {
      pointerId: event.pointerId,
      startWidth: sidebarWidth,
      startX: event.clientX,
    };
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizeMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resizeState = resizeStateRef.current;

    if (!resizeState) {
      return;
    }

    const nextWidth = clampSidebarWidth(
      resizeState.startWidth + (event.clientX - resizeState.startX),
    );

    sidebarWidthRef.current = nextWidth;
    setSidebarWidth(nextWidth);
  };

  const handleResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    let nextWidth: number | null = null;

    if (event.key === "ArrowLeft") {
      nextWidth = clampSidebarWidth(sidebarWidthRef.current - 16);
    } else if (event.key === "ArrowRight") {
      nextWidth = clampSidebarWidth(sidebarWidthRef.current + 16);
    } else if (event.key === "Home") {
      nextWidth = clampSidebarWidth(0);
    } else if (event.key === "End") {
      nextWidth = clampSidebarWidth(Number.MAX_SAFE_INTEGER);
    }

    if (nextWidth === null) {
      return;
    }

    event.preventDefault();
    sidebarWidthRef.current = nextWidth;
    setSidebarWidth(nextWidth);
    persistSidebarWidth(nextWidth);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key.toLowerCase() !== "k" ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        event.repeat
      ) {
        return;
      }

      if (!isCommandPaletteOpen && isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setIsCommandPaletteOpen((current) => !current);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isCommandPaletteOpen,
  ]);

  useEffect(() => {
    const isNodeActive = (node: SidebarTreeNode) =>
      node.kind === "program"
        ? pathname === "/programs" && selectedProgramId === node.id
        : isNodePathActive(pathname, node.href);

    setOpenKeys((current) => {
      const next = new Set(current);

      if (topLevelPath === "/projects") {
        next.add("section:projects");
      }

      if (topLevelPath === "/programs") {
        next.add("section:programs");
      }

      for (const key of collectActiveSidebarKeys(
        sidebarData.projects,
        isNodeActive,
      )) {
        next.add(key);
      }

      for (const key of collectActiveSidebarKeys(
        sidebarData.programs,
        isNodeActive,
      )) {
        next.add(key);
      }

      return next;
    });
  }, [
    pathname,
    sidebarData.programs,
    sidebarData.projects,
    selectedProgramId,
    topLevelPath,
  ]);

  const supabase = createClient();

  useEffect(() => {
    const applyMutation = (mutation: SidebarMutation) => {
      setSidebarData((current) => applySidebarMutation(current, mutation));
    };

    const channel = supabase
      .channel("gui-sidebar")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project",
        },
        (payload) => {
          const change = payload as RealtimePayload<ProjectRow>;

          if (change.eventType === "DELETE") {
            if (typeof change.old.id !== "string") {
              return;
            }

            applyMutation({
              id: change.old.id,
              type: "project:delete",
            });
            return;
          }

          applyMutation({
            row: change.new as ProjectRow,
            type: "project:upsert",
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table",
        },
        (payload) => {
          const change = payload as RealtimePayload<TableRow>;

          if (change.eventType === "DELETE") {
            if (typeof change.old.id !== "string") {
              return;
            }

            applyMutation({
              id: change.old.id,
              type: "table:delete",
            });
            return;
          }

          applyMutation({
            row: change.new as TableRow,
            type: "table:upsert",
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "program",
        },
        (payload) => {
          const change = payload as RealtimePayload<ProgramRow>;

          if (change.eventType === "DELETE") {
            if (typeof change.old.id !== "string") {
              return;
            }

            applyMutation({
              id: change.old.id,
              type: "program:delete",
            });
            return;
          }

          applyMutation({
            row: change.new as ProgramRow,
            type: "program:upsert",
          });
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || error) {
          console.error("GUI sidebar realtime channel failed");
          console.log(status, error);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    supabase,
  ]);

  useEffect(
    () => () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    [],
  );

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [
    sidebarWidth,
  ]);

  const isNodeActive = (node: SidebarTreeNode) =>
    node.kind === "program"
      ? pathname === "/programs" && selectedProgramId === node.id
      : isNodePathActive(pathname, node.href);

  const renderTree = (nodes: SidebarTreeNode[]) =>
    nodes.map((node) => {
      const nodeKey = `node:${node.id}`;
      const isOpen = openKeys.has(nodeKey);
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
            onToggle={() => toggleOpen(nodeKey)}
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
    <div
      className={cx(
        "grid h-screen grid-cols-1 grid-rows-1 bg-taupe-100 md:[grid-template-columns:var(--gui-sidebar-columns)]",
        isResizing
          ? ""
          : "transition-[grid-template-columns] duration-200 ease-out",
      )}
      style={
        {
          "--gui-sidebar-columns":
            sidebarMode === "collapsed"
              ? `${COLLAPSED_SIDEBAR_WIDTH}px minmax(0, 1fr)`
              : expandedGridColumns,
        } as CSSProperties
      }
    >
      <div className="relative">
        <aside
          className={cx(
            "flex size-full min-h-0 flex-col pt-6 transition-[padding] duration-200 ease-out h-screen overflow-y-scroll",
            sidebar.asideClassName,
          )}
        >
          <div className="flex w-full flex-col gap-2">
            <div
              className={cx("flex w-full items-center", sidebar.brandClassName)}
            >
              <MarbleWorkspacePopover
                className={cx(sidebar.iconOnly ? null : "flex-1")}
                compact={sidebar.iconOnly}
                description="Default workspace"
                name="Verdn"
                sections={workspaceMenuSections}
              />

              {sidebar.iconOnly ? null : (
                <button
                  aria-label={sidebar.toggleLabel}
                  className="flex size-8 items-center justify-center rounded-md text-taupe-500 transition-colors hover:bg-taupe-200 hover:text-taupe-800"
                  onClick={toggleSidebar}
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

            {!sidebar.iconOnly && signOutError ? (
              <p className="px-2 text-red-600 text-xs">{signOutError}</p>
            ) : null}
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
                  const isOpen = openKeys.has(sectionKey);

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
                        onToggle={() => toggleOpen(sectionKey)}
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
                  onSelect={
                    route.name === "Help" ? openCommandPalette : undefined
                  }
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
            onClick={toggleSidebar}
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
          <button
            aria-label="Resize sidebar"
            className="group absolute top-0 right-0 z-10 h-full w-3 translate-x-1/2 cursor-col-resize touch-none"
            onKeyDown={handleResizeKeyDown}
            onPointerCancel={finishResize}
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={finishResize}
            ref={resizeHandleRef}
            title="Resize sidebar"
            type="button"
          >
            <div
              className={cx(
                "mx-auto h-full w-px bg-transparent transition-colors",
                isResizing ? "bg-taupe-400" : "group-hover:bg-taupe-300",
              )}
            />
          </button>
        )}
      </div>

      <main className="bg-transparent p-2 pb-8">
        <div className="size-full overflow-hidden rounded-md border border-taupe-200 bg-taupe-50 shadow-md">
          {children}
        </div>
      </main>

      <MarbleCommandDialog
        label="Global command palette"
        loop
        onOpenChange={setIsCommandPaletteOpen}
        open={isCommandPaletteOpen}
      >
        <MarbleCommandInput placeholder="Search projects, programs, profiles, or help..." />
        <MarbleCommandList>
          <MarbleCommandEmpty>
            No matching command. Try `projects`, `rows`, `people`, or `help`.
          </MarbleCommandEmpty>

          {commandPaletteSections.map((section, sectionIndex) => (
            <div key={section.id}>
              {sectionIndex > 0 ? <MarbleCommandSeparator /> : null}
              <MarbleCommandGroup heading={section.heading}>
                {section.items.map((item) => (
                  <MarbleCommandItem
                    key={item.id}
                    keywords={item.keywords}
                    onSelect={item.onSelect}
                    value={item.label}
                  >
                    {item.icon}
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="font-mono text-[10px] text-taupe-400 uppercase tracking-[0.18em]">
                      {item.detail}
                    </span>
                  </MarbleCommandItem>
                ))}
              </MarbleCommandGroup>
            </div>
          ))}
        </MarbleCommandList>

        <div className="flex items-center justify-between border-t border-taupe-200 bg-linear-to-r from-taupe-50 via-white to-white px-4 py-2 text-[11px] text-taupe-500 uppercase tracking-[0.18em]">
          <span>Help now opens this palette</span>
          <span>Cmd/Ctrl + K</span>
        </div>
      </MarbleCommandDialog>
    </div>
  );
}
