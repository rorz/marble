"use client";

import type { Database } from "@marble/supabase";
import {
  cx,
  MarbleActivityRadar,
  type MarbleActivityRadarBatch,
  type MarbleActivityRadarSegment,
  MarbleBadge,
  MarbleButton,
  MarbleCommandDialog,
  MarbleCommandEmpty,
  MarbleCommandGroup,
  MarbleCommandInput,
  MarbleCommandItem,
  MarbleCommandList,
  MarbleCommandSeparator,
  MarbleSheet,
  MarbleSheetContent,
  MarbleSheetDescription,
  MarbleSheetFooter,
  MarbleSheetHeader,
  MarbleSheetTitle,
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
type EventRow = Database["public"]["Tables"]["event"]["Row"];
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
type SupportSheetView = "contact" | "handbook";
type RadarScope = {
  href: string;
  key: string;
  label: string;
};
type RadarBatchRecord = {
  description: string;
  href: string;
  id: string;
  label: string;
  latestAt: string;
  segments: MarbleActivityRadarSegment[];
  unread: boolean;
};
type SidebarRadarIndexes = {
  programs: Map<string, string>;
  projects: Map<string, string>;
  tables: Map<
    string,
    {
      label: string;
      projectId: string;
    }
  >;
};

const supportSheetWidthClassName = "w-[min(32rem,calc(100vw-1rem))]";
const CHANGE_RADAR_EVENT_LIMIT = 72;
const CHANGE_RADAR_BATCH_LIMIT = 8;
const CHANGE_RADAR_MERGE_WINDOW_MS = 8_000;
const CHANGE_RADAR_STORAGE_KEY = "marble:change-radar:last-reviewed-at";
const RADAR_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function pluralize(label: string, count: number) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function formatRadarRelativeTime(value: string) {
  const diffMs = new Date(value).getTime() - Date.now();
  const absDiffMs = Math.abs(diffMs);

  if (absDiffMs < 15_000) {
    return "Just now";
  }

  if (absDiffMs < 3_600_000) {
    return RADAR_TIME_FORMATTER.format(Math.round(diffMs / 60_000), "minute");
  }

  if (absDiffMs < 86_400_000) {
    return RADAR_TIME_FORMATTER.format(Math.round(diffMs / 3_600_000), "hour");
  }

  return RADAR_TIME_FORMATTER.format(Math.round(diffMs / 86_400_000), "day");
}

function getEventSnapshot(event: EventRow) {
  if (isRecord(event.after_state)) {
    return event.after_state;
  }

  if (isRecord(event.before_state)) {
    return event.before_state;
  }

  return null;
}

function getStringField(snapshot: Record<string, unknown> | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildSidebarRadarIndexes(sidebarData: SidebarTreeData) {
  const indexes: SidebarRadarIndexes = {
    programs: new Map(),
    projects: new Map(),
    tables: new Map(),
  };

  for (const node of sidebarData.programs) {
    indexes.programs.set(node.id, node.label);
  }

  for (const projectNode of sidebarData.projects) {
    indexes.projects.set(projectNode.id, projectNode.label);

    for (const tableNode of projectNode.children) {
      indexes.tables.set(tableNode.id, {
        label: tableNode.label,
        projectId: projectNode.id,
      });
    }
  }

  return indexes;
}

function resolveRadarScope(
  event: EventRow,
  indexes: SidebarRadarIndexes,
  cellTableIds: Record<string, null | string>,
): RadarScope {
  const snapshot = getEventSnapshot(event);

  if (event.resource === "project") {
    const projectLabel =
      indexes.projects.get(event.entity_id) ??
      getStringField(snapshot, "name") ??
      "Project changes";

    return {
      href: `/projects/${event.entity_id}`,
      key: `project:${event.entity_id}`,
      label: projectLabel,
    };
  }

  if (event.resource === "table") {
    const table = indexes.tables.get(event.entity_id);
    const tableLabel =
      table?.label ?? getStringField(snapshot, "name") ?? "Table changes";

    return {
      href: table
        ? `/projects/${table.projectId}/tables/${event.entity_id}`
        : "/events",
      key: `table:${event.entity_id}`,
      label: tableLabel,
    };
  }

  if (event.resource === "row" || event.resource === "column") {
    const tableId = getStringField(snapshot, "table_id");
    const table = tableId ? indexes.tables.get(tableId) : undefined;

    if (tableId && table) {
      return {
        href: `/projects/${table.projectId}/tables/${tableId}`,
        key: `table:${tableId}`,
        label: table.label,
      };
    }
  }

  if (event.resource === "cell") {
    const tableId = cellTableIds[event.entity_id];
    const table = tableId ? indexes.tables.get(tableId) : undefined;

    if (tableId && table) {
      return {
        href: `/projects/${table.projectId}/tables/${tableId}`,
        key: `table:${tableId}`,
        label: table.label,
      };
    }
  }

  if (event.resource === "program") {
    const label =
      indexes.programs.get(event.entity_id) ??
      getStringField(snapshot, "name") ??
      "Program changes";

    return {
      href: `/programs?programId=${event.entity_id}`,
      key: `program:${event.entity_id}`,
      label,
    };
  }

  return {
    href: "/events",
    key: `events:${event.resource}:${event.entity_id}`,
    label: titleCase(event.resource),
  };
}

function buildRadarSegments(
  counts: Record<EventRow["operation"], number>,
): MarbleActivityRadarSegment[] {
  return [
    counts.Create > 0
      ? {
          tone: "create",
          value: counts.Create,
        }
      : null,
    counts.Update > 0
      ? {
          tone: "update",
          value: counts.Update,
        }
      : null,
    counts.Delete > 0
      ? {
          tone: "delete",
          value: counts.Delete,
        }
      : null,
  ].filter(
    (segment): segment is MarbleActivityRadarSegment => segment !== null,
  );
}

function buildRadarDescription(
  operationCounts: Record<EventRow["operation"], number>,
  resourceCounts: Map<string, number>,
) {
  const operationSummary = [
    operationCounts.Create > 0 ? `+${operationCounts.Create}` : null,
    operationCounts.Update > 0 ? `~${operationCounts.Update}` : null,
    operationCounts.Delete > 0 ? `-${operationCounts.Delete}` : null,
  ]
    .filter((segment): segment is string => segment !== null)
    .join(" ");
  const resourceSummary = Array.from(resourceCounts.entries())
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, 2)
    .map(([resource, count]) => pluralize(titleCase(resource), count))
    .join(" · ");

  return [
    operationSummary,
    resourceSummary,
  ]
    .filter((segment) => segment.length > 0)
    .join(" · ");
}

function buildRadarBatches(
  events: EventRow[],
  indexes: SidebarRadarIndexes,
  cellTableIds: Record<string, null | string>,
  lastReviewedAt: null | string,
) {
  const batches: Array<
    RadarBatchRecord & {
      oldestMs: number;
      requestId: null | string;
      resourceCounts: Map<string, number>;
      scopeKey: string;
      source: EventRow["source"];
    }
  > = [];

  for (const event of events
    .filter((candidate) => candidate.operation !== "Read")
    .sort((left, right) => right.created_at.localeCompare(left.created_at))) {
    const scope = resolveRadarScope(event, indexes, cellTableIds);
    const eventMs = new Date(event.created_at).getTime();
    const requestId = event.request_id ?? null;
    const previous = batches.at(-1);
    const canMerge =
      previous !== undefined &&
      previous.scopeKey === scope.key &&
      previous.source === event.source &&
      (requestId !== null && previous.requestId !== null
        ? requestId === previous.requestId
        : previous.oldestMs - eventMs <= CHANGE_RADAR_MERGE_WINDOW_MS);

    if (!canMerge) {
      const operationCounts = {
        Create: event.operation === "Create" ? 1 : 0,
        Delete: event.operation === "Delete" ? 1 : 0,
        Read: 0,
        Update: event.operation === "Update" ? 1 : 0,
      } satisfies Record<EventRow["operation"], number>;
      const resourceCounts = new Map<string, number>([
        [
          event.resource,
          1,
        ],
      ]);

      batches.push({
        description: buildRadarDescription(operationCounts, resourceCounts),
        href: scope.href,
        id:
          requestId !== null
            ? `${scope.key}:${requestId}`
            : `${scope.key}:${event.created_at}`,
        label: scope.label,
        latestAt: event.created_at,
        oldestMs: eventMs,
        requestId,
        resourceCounts,
        scopeKey: scope.key,
        segments: buildRadarSegments(operationCounts),
        source: event.source,
        unread:
          lastReviewedAt === null ||
          event.created_at.localeCompare(lastReviewedAt) > 0,
      });
      continue;
    }

    previous.oldestMs = eventMs;
    previous.resourceCounts.set(
      event.resource,
      (previous.resourceCounts.get(event.resource) ?? 0) + 1,
    );
    previous.unread =
      previous.unread ||
      lastReviewedAt === null ||
      event.created_at.localeCompare(lastReviewedAt) > 0;

    if (event.operation === "Create") {
      previous.segments = buildRadarSegments({
        Create:
          previous.segments
            .filter((segment) => segment.tone === "create")
            .reduce((total, segment) => total + segment.value, 0) + 1,
        Delete: previous.segments
          .filter((segment) => segment.tone === "delete")
          .reduce((total, segment) => total + segment.value, 0),
        Read: 0,
        Update: previous.segments
          .filter((segment) => segment.tone === "update")
          .reduce((total, segment) => total + segment.value, 0),
      });
    } else if (event.operation === "Update") {
      previous.segments = buildRadarSegments({
        Create: previous.segments
          .filter((segment) => segment.tone === "create")
          .reduce((total, segment) => total + segment.value, 0),
        Delete: previous.segments
          .filter((segment) => segment.tone === "delete")
          .reduce((total, segment) => total + segment.value, 0),
        Read: 0,
        Update:
          previous.segments
            .filter((segment) => segment.tone === "update")
            .reduce((total, segment) => total + segment.value, 0) + 1,
      });
    } else if (event.operation === "Delete") {
      previous.segments = buildRadarSegments({
        Create: previous.segments
          .filter((segment) => segment.tone === "create")
          .reduce((total, segment) => total + segment.value, 0),
        Delete:
          previous.segments
            .filter((segment) => segment.tone === "delete")
            .reduce((total, segment) => total + segment.value, 0) + 1,
        Read: 0,
        Update: previous.segments
          .filter((segment) => segment.tone === "update")
          .reduce((total, segment) => total + segment.value, 0),
      });
    }

    previous.description = buildRadarDescription(
      {
        Create: previous.segments
          .filter((segment) => segment.tone === "create")
          .reduce((total, segment) => total + segment.value, 0),
        Delete: previous.segments
          .filter((segment) => segment.tone === "delete")
          .reduce((total, segment) => total + segment.value, 0),
        Read: 0,
        Update: previous.segments
          .filter((segment) => segment.tone === "update")
          .reduce((total, segment) => total + segment.value, 0),
      },
      previous.resourceCounts,
    );
  }

  return batches
    .slice(0, CHANGE_RADAR_BATCH_LIMIT)
    .map(
      ({
        oldestMs: _oldestMs,
        requestId: _requestId,
        resourceCounts: _resourceCounts,
        scopeKey: _scopeKey,
        source: _source,
        ...batch
      }) => batch,
    );
}

function upsertRadarEvent(current: EventRow[], nextEvent: EventRow) {
  return [
    nextEvent,
    ...current.filter((event) => event.id !== nextEvent.id),
  ]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, CHANGE_RADAR_EVENT_LIMIT);
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

function SupportPanelSection({
  children,
  title,
}: Readonly<{
  children: ReactNode;
  title: string;
}>) {
  return (
    <section className="space-y-2">
      <h3 className="font-medium text-sm text-taupe-900">{title}</h3>
      <div className="space-y-2 text-sm text-taupe-700">{children}</div>
    </section>
  );
}

function CommandPaletteSupportSheet({
  onClose,
  view,
}: Readonly<{
  onClose: () => void;
  view: SupportSheetView;
}>) {
  if (view === "contact") {
    return (
      <>
        <MarbleSheetHeader>
          <MarbleSheetTitle>Contact Us</MarbleSheetTitle>
          <MarbleSheetDescription>
            Placeholder support surface while the real contact flow is still
            being wired up.
          </MarbleSheetDescription>
        </MarbleSheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <MarbleBadge
            caps
            tone="warning"
          >
            Placeholder
          </MarbleBadge>

          <SupportPanelSection title="What this will become">
            <p>
              This slot is reserved for direct support routing, escalation
              instructions, and whatever contact mechanism we settle on next.
            </p>
          </SupportPanelSection>

          <SupportPanelSection title="For now">
            <p>
              Use the Marble Handbook for product navigation and keep this item
              around as the obvious support-shaped follow-up in the menu.
            </p>
          </SupportPanelSection>
        </div>

        <MarbleSheetFooter>
          <MarbleButton onClick={onClose}>Close</MarbleButton>
        </MarbleSheetFooter>
      </>
    );
  }

  return (
    <>
      <MarbleSheetHeader>
        <MarbleSheetTitle>Marble Handbook</MarbleSheetTitle>
        <MarbleSheetDescription>
          A command-menu-native guide for the core Marble surfaces.
        </MarbleSheetDescription>
      </MarbleSheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <MarbleBadge
          caps
          tone="info"
        >
          Inside cmdk
        </MarbleBadge>

        <SupportPanelSection title="Jump anywhere">
          <p>
            Open the palette with Cmd/Ctrl+K, then search for projects, tables,
            programs, profiles, automations, or events to move without touching
            the sidebar.
          </p>
        </SupportPanelSection>

        <SupportPanelSection title="Search behavior">
          <p>
            Command items already carry keywords, so typing terms like `help`,
            `docs`, `rows`, `people`, or resource names is enough to surface the
            right target.
          </p>
        </SupportPanelSection>

        <SupportPanelSection title="Support entry points">
          <p>
            Search `help` to reopen this handbook. The adjacent contact entry is
            intentionally a placeholder until the real support path lands.
          </p>
        </SupportPanelSection>
      </div>

      <MarbleSheetFooter>
        <MarbleButton onClick={onClose}>Close</MarbleButton>
      </MarbleSheetFooter>
    </>
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
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [commandPaletteSupportSheet, setCommandPaletteSupportSheet] =
    useState<SupportSheetView | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [supabase] = useState(() => createClient());
  const [radarEvents, setRadarEvents] = useState<EventRow[]>([]);
  const [lastReviewedAt, setLastReviewedAt] = useState<null | string>(null);
  const [cellTableIds, setCellTableIds] = useState<
    Record<string, null | string>
  >({});
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
  const ownedProfileIds = sidebarData.ownerProfileIds;
  const ownedProfileIdsKey = ownedProfileIds.join(":");
  const sidebarRadarIndexes = buildSidebarRadarIndexes(sidebarData);
  const topLevelPath = `/${pathname.split("/").at(1)}`;
  const selectedProgramId = searchParams.get("programId");
  const resetCommandPalette = () => {
    setCommandPaletteQuery("");
    setCommandPaletteSupportSheet(null);
  };
  const handleCommandPaletteOpenChange = (nextOpen: boolean) => {
    setIsCommandPaletteOpen(nextOpen);

    if (!nextOpen) {
      resetCommandPalette();
    }
  };
  const openCommandPalette = (query = "") => {
    setCommandPaletteQuery(query);
    setCommandPaletteSupportSheet(null);
    setIsCommandPaletteOpen(true);
  };
  const openHelpCommandPalette = () => {
    openCommandPalette("help");
  };
  const closeCommandPalette = () => {
    handleCommandPaletteOpenChange(false);
  };
  const navigateFromCommandPalette = (path: string) => {
    closeCommandPalette();
    router.push(path);
  };
  const persistRadarReviewState = (nextValue: null | string) => {
    setLastReviewedAt(nextValue);

    if (typeof window === "undefined") {
      return;
    }

    if (nextValue === null) {
      window.localStorage.removeItem(CHANGE_RADAR_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CHANGE_RADAR_STORAGE_KEY, nextValue);
  };
  const markRadarReviewedThrough = (timestamp: null | string) => {
    if (!timestamp) {
      return;
    }

    if (lastReviewedAt && timestamp.localeCompare(lastReviewedAt) < 0) {
      return;
    }

    persistRadarReviewState(timestamp);
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
          onSelect: openHelpCommandPalette,
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
  const supportCommandSection: CommandPaletteSection = {
    heading: "Support",
    id: "command-palette-support",
    items: [
      {
        detail: "Guide",
        icon: (
          <BookOpenTextIcon
            size={16}
            weight="regular"
          />
        ),
        id: "command-palette-marble-handbook",
        keywords: [
          "docs",
          "documentation",
          "guide",
          "handbook",
          "help",
          "support",
        ],
        label: "Marble Handbook",
        onSelect: () => {
          closeCommandPalette();
          setCommandPaletteSupportSheet("handbook");
        },
      },
      {
        detail: "Soon",
        icon: (
          <LifebuoyIcon
            size={16}
            weight="regular"
          />
        ),
        id: "command-palette-contact-us",
        keywords: [
          "contact",
          "email",
          "help",
          "support",
        ],
        label: "Contact us",
        onSelect: () => {
          closeCommandPalette();
          setCommandPaletteSupportSheet("contact");
        },
      },
    ],
  };
  const commandPaletteCoreSections: CommandPaletteSection[] = [
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
      ],
    },
  ];
  const isSupportQuery = [
    "contact",
    "docs",
    "handbook",
    "help",
    "support",
  ].some((term) => commandPaletteQuery.toLowerCase().includes(term));
  const commandPaletteSections: CommandPaletteSection[] = (
    isSupportQuery
      ? [
          supportCommandSection,
          ...commandPaletteCoreSections,
        ]
      : [
          ...commandPaletteCoreSections,
          supportCommandSection,
        ]
  ).filter((section) => section.items.length > 0);
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
      const normalizedKey =
        typeof event.key === "string" ? event.key.toLowerCase() : "";

      if (
        event.defaultPrevented ||
        normalizedKey !== "k" ||
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

      if (isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
        setCommandPaletteQuery("");
        setCommandPaletteSupportSheet(null);
        return;
      }

      setCommandPaletteQuery("");
      setCommandPaletteSupportSheet(null);
      setIsCommandPaletteOpen(true);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isCommandPaletteOpen,
  ]);

  useEffect(() => {
    if (commandPaletteSupportSheet === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setCommandPaletteSupportSheet(null);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    commandPaletteSupportSheet,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setLastReviewedAt(
      window.localStorage.getItem(CHANGE_RADAR_STORAGE_KEY) ?? null,
    );
  }, []);

  useEffect(() => {
    if (ownedProfileIds.length === 0) {
      setRadarEvents([]);
      return;
    }

    let cancelled = false;
    const ownedProfileIdSet = new Set(ownedProfileIds);

    void supabase
      .from("event")
      .select("*")
      .in("actor_profile_id", ownedProfileIds)
      .neq("source", "WEB_APP")
      .order("created_at", {
        ascending: false,
      })
      .limit(CHANGE_RADAR_EVENT_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        if (error) {
          console.error("Change radar bootstrap failed", error);
          return;
        }

        setRadarEvents(
          ((data ?? []) as EventRow[]).filter(
            (event) => event.operation !== "Read",
          ),
        );
      });

    const channel = supabase
      .channel(`gui-radar:${ownedProfileIdsKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event",
        },
        (payload) => {
          const change = payload as RealtimePayload<EventRow>;
          const candidate =
            change.eventType === "DELETE" ? change.old : change.new;
          const actorProfileId = candidate.actor_profile_id;
          const eventId = candidate.id;

          if (
            typeof eventId !== "string" ||
            typeof actorProfileId !== "string" ||
            !ownedProfileIdSet.has(actorProfileId) ||
            candidate.source === "WEB_APP" ||
            candidate.operation === "Read"
          ) {
            return;
          }

          setRadarEvents((current) =>
            change.eventType === "DELETE"
              ? current.filter((event) => event.id !== eventId)
              : upsertRadarEvent(current, change.new as EventRow),
          );
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || error) {
          console.error("Change radar realtime channel failed", error);
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [
    ownedProfileIds,
    ownedProfileIdsKey,
    supabase,
  ]);

  useEffect(() => {
    const unresolvedCellEvents = radarEvents.filter(
      (event) =>
        event.resource === "cell" &&
        cellTableIds[event.entity_id] === undefined,
    );

    if (unresolvedCellEvents.length === 0) {
      return;
    }

    const eventTargets = unresolvedCellEvents.map((event) => ({
      columnId: getStringField(getEventSnapshot(event), "column_id"),
      eventId: event.entity_id,
      rowId: getStringField(getEventSnapshot(event), "row_id"),
    }));
    const rowIds = Array.from(
      new Set(
        eventTargets.flatMap((target) =>
          target.rowId
            ? [
                target.rowId,
              ]
            : [],
        ),
      ),
    );
    const columnIds = Array.from(
      new Set(
        eventTargets.flatMap((target) =>
          target.columnId
            ? [
                target.columnId,
              ]
            : [],
        ),
      ),
    );

    if (rowIds.length === 0 && columnIds.length === 0) {
      setCellTableIds((current) =>
        Object.fromEntries([
          ...Object.entries(current),
          ...eventTargets.map((target) => [
            target.eventId,
            null,
          ]),
        ]),
      );
      return;
    }

    let cancelled = false;

    void Promise.all([
      rowIds.length > 0
        ? supabase.from("row").select("id, table_id").in("id", rowIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              table_id: string;
            }>,
            error: null,
          }),
      columnIds.length > 0
        ? supabase.from("column").select("id, table_id").in("id", columnIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              table_id: string;
            }>,
            error: null,
          }),
    ]).then(([rowsResult, columnsResult]) => {
      if (cancelled) {
        return;
      }

      if (rowsResult.error || columnsResult.error) {
        console.error(
          "Change radar cell scope resolution failed",
          rowsResult.error ?? columnsResult.error,
        );
        return;
      }

      const rowTableIds = new Map(
        (rowsResult.data ?? []).map((row) => [
          row.id,
          row.table_id,
        ]),
      );
      const columnTableIds = new Map(
        (columnsResult.data ?? []).map((column) => [
          column.id,
          column.table_id,
        ]),
      );

      setCellTableIds((current) => {
        const next = {
          ...current,
        };

        for (const target of eventTargets) {
          if (next[target.eventId] !== undefined) {
            continue;
          }

          next[target.eventId] =
            (target.rowId ? rowTableIds.get(target.rowId) : undefined) ??
            (target.columnId
              ? columnTableIds.get(target.columnId)
              : undefined) ??
            null;
        }

        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    cellTableIds,
    radarEvents,
    supabase,
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
  const radarBatchRecords = buildRadarBatches(
    radarEvents,
    sidebarRadarIndexes,
    cellTableIds,
    lastReviewedAt,
  );
  const radarBatches: MarbleActivityRadarBatch[] = radarBatchRecords.map(
    (batch) => ({
      description: batch.description,
      id: batch.id,
      label: batch.label,
      onSelect: () => {
        markRadarReviewedThrough(batch.latestAt);
        router.push(batch.href);
      },
      segments: batch.segments,
      timestampLabel: formatRadarRelativeTime(batch.latestAt),
      unread: batch.unread,
    }),
  );
  const radarUnreadCount = radarBatchRecords.filter(
    (batch) => batch.unread,
  ).length;
  const handleMarkVisibleRadarBatchesReviewed = () => {
    markRadarReviewedThrough(radarBatchRecords[0]?.latestAt ?? null);
  };

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

              <MarbleActivityRadar
                batches={radarBatches}
                className="shrink-0"
                compact
                onMarkAllRead={handleMarkVisibleRadarBatchesReviewed}
                onOpenFeed={() => router.push("/events")}
                unreadCount={radarUnreadCount}
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
                    route.name === "Help" ? openHelpCommandPalette : undefined
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
        onOpenChange={handleCommandPaletteOpenChange}
        open={isCommandPaletteOpen}
      >
        <MarbleCommandInput
          onValueChange={setCommandPaletteQuery}
          placeholder="Search projects, programs, profiles, or help..."
          value={commandPaletteQuery}
        />
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

        <div className="flex items-center justify-between border-t border-taupe-200 bg-linear-to-t from-taupe-200 via-white to-white px-4 py-2 text-[11px] text-taupe-500 uppercase tracking-[0.18em]">
          <span>Enter opens the selected item</span>
          <span>
            {commandPaletteSupportSheet !== null
              ? "Esc closes the side panel first"
              : "Cmd/Ctrl+K toggles this menu"}
          </span>
        </div>
      </MarbleCommandDialog>

      {commandPaletteSupportSheet ? (
        <MarbleSheet
          onOpenChange={(open) => {
            if (!open) {
              setCommandPaletteSupportSheet(null);
            }
          }}
          open
        >
          <MarbleSheetContent
            className={cx(supportSheetWidthClassName, "border-y-0 border-r-0")}
            side="right"
          >
            <CommandPaletteSupportSheet
              onClose={() => setCommandPaletteSupportSheet(null)}
              view={commandPaletteSupportSheet}
            />
          </MarbleSheetContent>
        </MarbleSheet>
      ) : null}
    </div>
  );
}
