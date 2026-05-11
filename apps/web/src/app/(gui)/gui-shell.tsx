"use client";

import type { MarbleClient } from "@marble/sdk";
import {
  cx,
  MarbleAccountPopover,
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
  marbleToast,
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
  FunnelIcon,
  IdentificationBadgeIcon,
  KeyIcon,
  LifebuoyIcon,
  PipeIcon,
  RobotIcon,
  SidebarIcon,
  SignOutIcon,
  TableIcon,
  UserCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applySidebarTreeState,
  COLLAPSED_AGENT_SIDEBAR_WIDTH,
  COLLAPSED_SIDEBAR_WIDTH,
  clampAgentSidebarWidth,
  clampSidebarWidth,
  MAX_AGENT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_AGENT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  type SidebarMode,
  type SidebarTreeState,
  updateSidebarTreeStateForKey,
} from "../../lib/gui-sidebar";
import {
  useMarbleSdkFactory,
  useMarbleWebSessionSdk,
} from "../../lib/marble-sdk-client";
import { createDefaultProgram } from "../../lib/program-client";
import { usePrivateBroadcast } from "../../lib/realtime/private-broadcast";
import { getErrorMessage } from "../../lib/realtime-crud";
import {
  applySidebarMutation,
  isSidebarMutation,
} from "../../lib/sidebar-sync";
import {
  collectActiveSidebarKeys,
  type SidebarTreeData,
  type SidebarTreeNode,
} from "../../lib/sidebar-tree";
import { useSignOut } from "../sign-out-button";
import { ChangeRadar } from "./change-radar";
import {
  ChangeSpotlight,
  changeTargetKey,
  getChangeTargetProps,
  parseChangeTargetKey,
  useChangeSpotlightPreviewTargetKeys,
} from "./change-spotlight";

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

function createDefaultProfile(sdk: MarbleClient) {
  return sdk.profiles.create({
    externalName: null,
    icon: "🤖",
    name: "Untitled Agent",
    type: "Agent",
  });
}

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
          <KeyIcon
            size={20}
            weight="regular"
          />
        ),
        id: "secrets",
        name: "Secrets",
        path: "/secrets",
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
type CommandPalettePage =
  | "create-pipe-project"
  | "create-source-project"
  | "create-table-project";
type SupportSheetView = "contact" | "handbook";

const GUI_SIDEBAR_FIRST_PARTY_PROGRAMS_TOPIC =
  "gui-sidebar:first-party-programs";

const guiSidebarUserTopic = (userId: string) => `gui-sidebar:user:${userId}`;

const supportSheetWidthClassName = "w-[min(32rem,calc(100vw-1rem))]";

function getProjectIdFromPathname(pathname: string) {
  const segments = pathname.split("/");

  if (segments.at(1) !== "projects") {
    return null;
  }

  const projectId = segments.at(2);

  return projectId && projectId !== "new" ? projectId : null;
}

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

function findProjectChildNode(
  projectNode: SidebarTreeNode,
  kind: "source" | "table",
) {
  return projectNode.children.find((child) => child.kind === kind) ?? null;
}

function getPipeCreateDefaults(projectNode: SidebarTreeNode) {
  const sourceNode = findProjectChildNode(projectNode, "source");
  const tableNode = findProjectChildNode(projectNode, "table");

  return sourceNode && tableNode
    ? {
        sourceId: sourceNode.id,
        tableId: tableNode.id,
      }
    : null;
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

  if (node.kind === "source") {
    return (
      <FunnelIcon
        className="h-4 w-4"
        weight="duotone"
      />
    );
  }

  if (node.kind === "pipe") {
    return (
      <PipeIcon
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

function getNodeTargetKey(node: SidebarTreeNode) {
  if (node.kind === "project") {
    return changeTargetKey.project(node.id);
  }

  if (node.kind === "table") {
    return changeTargetKey.table(node.id);
  }

  if (node.kind === "source") {
    return changeTargetKey.source(node.id);
  }

  if (node.kind === "pipe") {
    return changeTargetKey.pipe(node.id);
  }

  return changeTargetKey.program(node.id);
}

function buildDefaultSidebarOpenKeys({
  pathname,
  selectedProgramId,
  sidebarData,
  sidebarMode,
}: {
  pathname: string;
  selectedProgramId: null | string;
  sidebarData: SidebarTreeData;
  sidebarMode: SidebarMode;
}) {
  const keys = new Set<string>(
    sidebarMode === "expanded"
      ? [
          "section:programs",
          "section:projects",
        ]
      : [],
  );
  const topLevelPath = `/${pathname.split("/").at(1)}`;
  const isNodeActive = (node: SidebarTreeNode) =>
    node.kind === "program"
      ? pathname === "/programs" && selectedProgramId === node.id
      : isNodePathActive(pathname, node.href);

  if (topLevelPath === "/projects") {
    keys.add("section:projects");
  }

  if (topLevelPath === "/programs") {
    keys.add("section:programs");
  }

  for (const key of collectActiveSidebarKeys(
    sidebarData.projects,
    isNodeActive,
  )) {
    keys.add(key);
  }

  for (const key of collectActiveSidebarKeys(
    sidebarData.programs,
    isNodeActive,
  )) {
    keys.add(key);
  }

  return keys;
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
  previewTone = null,
  targetKey,
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
  previewTone?: "ancestor" | "direct" | null;
  targetKey?: string;
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
          : previewTone === "direct"
            ? "bg-white text-taupe-900 inset-ring-1 inset-ring-orange-500/40"
            : previewTone === "ancestor"
              ? "bg-orange-50/80 text-taupe-900"
              : "hover:bg-taupe-200/80 hover:text-taupe-900",
        iconOnly ? "w-auto justify-center" : "w-full pr-1",
      )}
      {...(targetKey ? getChangeTargetProps(targetKey) : {})}
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
        prefetch={false}
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
            sources, pipes, programs, profiles, automations, or events to move
            without touching the sidebar.
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
}) {
  const [agentSidebarMode, setAgentSidebarMode] = useState<SidebarMode>(
    initialAgentSidebarMode,
  );
  const [agentSidebarWidth, setAgentSidebarWidth] = useState(
    initialAgentSidebarWidth,
  );
  const [sidebarMode, setSidebarMode] =
    useState<SidebarMode>(initialSidebarMode);
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [sidebarData, setSidebarData] = useState(initialSidebarData);
  const [sidebarTreeState, setSidebarTreeState] = useState<SidebarTreeState>(
    initialSidebarTreeState,
  );
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [commandPalettePages, setCommandPalettePages] = useState<
    CommandPalettePage[]
  >([]);
  const [commandPaletteSupportSheet, setCommandPaletteSupportSheet] =
    useState<SupportSheetView | null>(null);
  const [isAgentSidebarResizing, setIsAgentSidebarResizing] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebar = sidebarModes[sidebarMode];
  const ToggleIcon = sidebar.toggleIcon;
  const router = useRouter();
  const getSdk = useMarbleSdkFactory();
  const sdk = useMemo(
    () => getSdk(),
    [
      getSdk,
    ],
  );
  const apiSdk = useMarbleWebSessionSdk();
  const {
    error: signOutError,
    pending: signOutPending,
    signOut,
  } = useSignOut();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewTargetKeys = useChangeSpotlightPreviewTargetKeys();
  const agentResizeHandleRef = useRef<HTMLHRElement | null>(null);
  const agentSidebarWidthRef = useRef(agentSidebarWidth);
  const agentResizeStateRef = useRef<null | {
    pointerId: number;
    startWidth: number;
    startX: number;
  }>(null);
  const agentSidebarToggleLabel =
    agentSidebarMode === "collapsed"
      ? "Expand agent sidebar"
      : "Collapse agent sidebar";
  const resizeHandleRef = useRef<HTMLHRElement | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const resizeStateRef = useRef<null | {
    pointerId: number;
    startWidth: number;
    startX: number;
  }>(null);
  const topLevelPath = `/${pathname.split("/").at(1)}`;
  const selectedProgramId = searchParams.get("programId");
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
  const currentCommandPalettePage = commandPalettePages.at(-1) ?? null;
  const resetCommandPalette = () => {
    setCommandPaletteQuery("");
    setCommandPalettePages([]);
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
  const handleCommandPaletteError = (error: unknown) => {
    marbleToast.error(getErrorMessage(error));
  };
  const pushCommandPalettePage = (page: CommandPalettePage) => {
    setCommandPalettePages((current) => [
      ...current,
      page,
    ]);
    setCommandPaletteQuery("");
  };
  const popCommandPalettePage = () => {
    setCommandPalettePages((current) => current.slice(0, -1));
    setCommandPaletteQuery("");
  };
  const handleCommandPaletteKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      currentCommandPalettePage === null ||
      !(
        event.key === "Escape" ||
        (event.key === "Backspace" && commandPaletteQuery.length === 0)
      )
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    popCommandPalettePage();
  };
  const accountMenuSections = [
    {
      id: "account-actions",
      items: [
        {
          icon: (
            <UserCircleIcon
              size={16}
              weight="regular"
            />
          ),
          id: "account-settings",
          label: "Account settings",
          onSelect: () => router.push("/account"),
        },
      ],
    },
    {
      id: "account-session",
      items: [
        {
          disabled: signOutPending,
          icon: (
            <SignOutIcon
              size={16}
              weight="regular"
            />
          ),
          id: "account-sign-out",
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
  const projectNodes = projectResources.filter(
    ({ node }) => node.kind === "project",
  );
  const selectedProjectId = getProjectIdFromPathname(pathname);
  const selectedProjectNode =
    selectedProjectId === null
      ? null
      : (projectNodes.find(({ node }) => node.id === selectedProjectId)?.node ??
        null);
  const defaultTableProjectNode =
    selectedProjectNode ??
    (projectNodes.length === 1 ? (projectNodes[0]?.node ?? null) : null);
  const defaultSourceProjectNode = defaultTableProjectNode;
  const pipeProjectNodes = projectNodes.filter(
    ({ node }) => getPipeCreateDefaults(node) !== null,
  );
  const defaultPipeProjectNode =
    selectedProjectNode && getPipeCreateDefaults(selectedProjectNode)
      ? selectedProjectNode
      : pipeProjectNodes.length === 1
        ? (pipeProjectNodes[0]?.node ?? null)
        : null;
  const hasProjectTargetsForNewTable = projectNodes.length > 0;
  const hasProjectTargetsForNewSource = projectNodes.length > 0;
  const hasProjectTargetsForNewPipe = pipeProjectNodes.length > 0;
  const createTableDetail = defaultTableProjectNode?.label ?? "Choose project";
  const createSourceDetail =
    defaultSourceProjectNode?.label ?? "Choose project";
  const createPipeDetail = defaultPipeProjectNode?.label ?? "Choose project";
  const handleCreateProjectFromCommandPalette = async () => {
    closeCommandPalette();

    try {
      const project = await sdk.projects.create({});
      router.push(`/projects/${project.id}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };
  const handleCreateTableForProjectFromCommandPalette = async (
    projectNode: SidebarTreeNode,
  ) => {
    closeCommandPalette();

    try {
      const table = await getSdk({
        profileId: projectNode.ownerProfileId,
      }).tables.create({
        projectId: projectNode.id,
      });
      router.push(`/projects/${projectNode.id}/tables/${table.id}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };
  const handleCreateTableFromCommandPalette = async () => {
    if (!hasProjectTargetsForNewTable) {
      return;
    }

    if (!defaultTableProjectNode) {
      pushCommandPalettePage("create-table-project");
      return;
    }

    await handleCreateTableForProjectFromCommandPalette(
      defaultTableProjectNode,
    );
  };
  const handleCreateSourceForProjectFromCommandPalette = async (
    projectNode: SidebarTreeNode,
  ) => {
    closeCommandPalette();

    try {
      const source = await getSdk({
        profileId: projectNode.ownerProfileId,
      }).sources.create({
        projectId: projectNode.id,
      });
      router.push(`/projects/${projectNode.id}/sources/${source.id}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };
  const handleCreateSourceFromCommandPalette = async () => {
    if (!hasProjectTargetsForNewSource) {
      return;
    }

    if (!defaultSourceProjectNode) {
      pushCommandPalettePage("create-source-project");
      return;
    }

    await handleCreateSourceForProjectFromCommandPalette(
      defaultSourceProjectNode,
    );
  };
  const handleCreatePipeForProjectFromCommandPalette = async (
    projectNode: SidebarTreeNode,
  ) => {
    const defaults = getPipeCreateDefaults(projectNode);

    if (!defaults) {
      return;
    }

    closeCommandPalette();

    try {
      const pipe = await getSdk({
        profileId: projectNode.ownerProfileId,
      }).pipes.create({
        mappings: [],
        sourceId: defaults.sourceId,
        tableId: defaults.tableId,
      });
      router.push(`/projects/${projectNode.id}/pipes/${pipe.id}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };
  const handleCreatePipeFromCommandPalette = async () => {
    if (!hasProjectTargetsForNewPipe) {
      return;
    }

    if (!defaultPipeProjectNode) {
      pushCommandPalettePage("create-pipe-project");
      return;
    }

    await handleCreatePipeForProjectFromCommandPalette(defaultPipeProjectNode);
  };
  const handleCreateProgramFromCommandPalette = async () => {
    closeCommandPalette();

    try {
      const { programId } = await createDefaultProgram(apiSdk);
      router.push(`/programs/${programId}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };
  const handleCreateProfileFromCommandPalette = async () => {
    closeCommandPalette();

    try {
      const profile = await createDefaultProfile(apiSdk);
      router.push(`/profiles?edit=${profile.id}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };
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
  const sourceCommandItems = projectResources
    .filter(({ node }) => node.kind === "source")
    .map(({ node, parents }) => {
      const parentPath = parents.map((parent) => parent.label);
      const projectLabel = parentPath.at(-1) ?? "Project";

      return {
        detail: projectLabel,
        icon: (
          <FunnelIcon
            size={16}
            weight="duotone"
          />
        ),
        id: `command-palette-source:${node.id}`,
        keywords: [
          "source",
          "webhook",
          "ingest",
          node.id,
          ...parentPath,
        ],
        label: node.label,
        onSelect: () => navigateFromCommandPalette(node.href),
      };
    });
  const pipeCommandItems = projectResources
    .filter(({ node }) => node.kind === "pipe")
    .map(({ node, parents }) => {
      const parentPath = parents.map((parent) => parent.label);
      const projectLabel = parentPath.at(-1) ?? "Project";

      return {
        detail: projectLabel,
        icon: (
          <PipeIcon
            size={16}
            weight="duotone"
          />
        ),
        id: `command-palette-pipe:${node.id}`,
        keywords: [
          "pipe",
          "mapping",
          "ingest",
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
  const rootCommandPaletteSections: CommandPaletteSection[] = [
    {
      heading: "New",
      id: "command-palette-create",
      items: [
        {
          detail: "Create",
          icon: (
            <BriefcaseMetalIcon
              size={16}
              weight="regular"
            />
          ),
          id: "command-palette-new-project",
          keywords: [
            "create",
            "new",
            "project",
            "workspace",
          ],
          label: "New project",
          onSelect: () => {
            void handleCreateProjectFromCommandPalette();
          },
        },
        ...(hasProjectTargetsForNewTable
          ? [
              {
                detail: createTableDetail,
                icon: (
                  <TableIcon
                    className="h-4 w-4"
                    weight="duotone"
                  />
                ),
                id: "command-palette-new-table",
                keywords: [
                  "create",
                  "new",
                  "table",
                  "rows",
                  "columns",
                  "schema",
                ],
                label: defaultTableProjectNode ? "New table" : "New table...",
                onSelect: () => {
                  void handleCreateTableFromCommandPalette();
                },
              },
            ]
          : []),
        ...(hasProjectTargetsForNewSource
          ? [
              {
                detail: createSourceDetail,
                icon: (
                  <FunnelIcon
                    size={16}
                    weight="duotone"
                  />
                ),
                id: "command-palette-new-source",
                keywords: [
                  "create",
                  "new",
                  "source",
                  "webhook",
                  "ingest",
                ],
                label: defaultSourceProjectNode
                  ? "New source"
                  : "New source...",
                onSelect: () => {
                  void handleCreateSourceFromCommandPalette();
                },
              },
            ]
          : []),
        ...(hasProjectTargetsForNewPipe
          ? [
              {
                detail: createPipeDetail,
                icon: (
                  <PipeIcon
                    size={16}
                    weight="duotone"
                  />
                ),
                id: "command-palette-new-pipe",
                keywords: [
                  "create",
                  "new",
                  "pipe",
                  "mapping",
                  "ingest",
                ],
                label: defaultPipeProjectNode ? "New pipe" : "New pipe...",
                onSelect: () => {
                  void handleCreatePipeFromCommandPalette();
                },
              },
            ]
          : []),
        {
          detail: "Create",
          icon: (
            <FileCodeIcon
              size={16}
              weight="regular"
            />
          ),
          id: "command-palette-new-program",
          keywords: [
            "create",
            "new",
            "program",
            "code",
            "runner",
          ],
          label: "New program",
          onSelect: () => {
            void handleCreateProgramFromCommandPalette();
          },
        },
        {
          detail: "Create",
          icon: (
            <IdentificationBadgeIcon
              size={16}
              weight="regular"
            />
          ),
          id: "command-palette-new-profile",
          keywords: [
            "create",
            "new",
            "profile",
            "agent",
            "persona",
          ],
          label: "New profile",
          onSelect: () => {
            void handleCreateProfileFromCommandPalette();
          },
        },
      ],
    },
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
        {
          detail: "/sources",
          icon: (
            <FunnelIcon
              size={16}
              weight="duotone"
            />
          ),
          id: "command-palette-sources",
          keywords: [
            "source",
            "webhook",
            "ingest",
          ],
          label: "Open sources",
          onSelect: () => navigateFromCommandPalette("/sources"),
        },
        {
          detail: "/pipes",
          icon: (
            <PipeIcon
              size={16}
              weight="duotone"
            />
          ),
          id: "command-palette-pipes",
          keywords: [
            "pipe",
            "mapping",
            "ingest",
          ],
          label: "Open pipes",
          onSelect: () => navigateFromCommandPalette("/pipes"),
        },
        {
          detail: "/secrets",
          icon: (
            <KeyIcon
              size={16}
              weight="regular"
            />
          ),
          id: "command-palette-secrets",
          keywords: [
            "credential",
            "key",
            "secret",
            "vault",
          ],
          label: "Open secrets",
          onSelect: () => navigateFromCommandPalette("/secrets"),
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
      heading: "Sources",
      id: "command-palette-source-resources",
      items: sourceCommandItems,
    },
    {
      heading: "Pipes",
      id: "command-palette-pipe-resources",
      items: pipeCommandItems,
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
  const createTableProjectSections: CommandPaletteSection[] = [
    {
      heading: "Choose project",
      id: "command-palette-create-table-project",
      items: projectNodes.map(({ node }) => ({
        detail: "Project",
        icon: (
          <BriefcaseMetalIcon
            size={16}
            weight="regular"
          />
        ),
        id: `command-palette-new-table-project:${node.id}`,
        keywords: [
          "create",
          "new",
          "project",
          "table",
          node.id,
        ],
        label: node.label,
        onSelect: () => {
          void handleCreateTableForProjectFromCommandPalette(node);
        },
      })),
    },
  ];
  const createSourceProjectSections: CommandPaletteSection[] = [
    {
      heading: "Choose project",
      id: "command-palette-create-source-project",
      items: projectNodes.map(({ node }) => ({
        detail: "Project",
        icon: (
          <BriefcaseMetalIcon
            size={16}
            weight="regular"
          />
        ),
        id: `command-palette-new-source-project:${node.id}`,
        keywords: [
          "create",
          "new",
          "project",
          "source",
          "webhook",
          node.id,
        ],
        label: node.label,
        onSelect: () => {
          void handleCreateSourceForProjectFromCommandPalette(node);
        },
      })),
    },
  ];
  const createPipeProjectSections: CommandPaletteSection[] = [
    {
      heading: "Choose project",
      id: "command-palette-create-pipe-project",
      items: pipeProjectNodes.map(({ node }) => ({
        detail: "Project",
        icon: (
          <BriefcaseMetalIcon
            size={16}
            weight="regular"
          />
        ),
        id: `command-palette-new-pipe-project:${node.id}`,
        keywords: [
          "create",
          "new",
          "project",
          "pipe",
          "mapping",
          node.id,
        ],
        label: node.label,
        onSelect: () => {
          void handleCreatePipeForProjectFromCommandPalette(node);
        },
      })),
    },
  ];
  const createProjectSectionsByPage = {
    "create-pipe-project": createPipeProjectSections,
    "create-source-project": createSourceProjectSections,
    "create-table-project": createTableProjectSections,
  } satisfies Record<CommandPalettePage, CommandPaletteSection[]>;
  const createResourceLabelByPage = {
    "create-pipe-project": "pipe",
    "create-source-project": "source",
    "create-table-project": "table",
  } satisfies Record<CommandPalettePage, string>;
  const normalizedCommandPaletteQuery = commandPaletteQuery.toLowerCase();
  const isSupportQuery =
    currentCommandPalettePage === null &&
    [
      "contact",
      "docs",
      "handbook",
      "help",
      "support",
    ].some((term) => normalizedCommandPaletteQuery.includes(term));
  const commandPaletteSections: CommandPaletteSection[] = (
    currentCommandPalettePage !== null
      ? createProjectSectionsByPage[currentCommandPalettePage]
      : isSupportQuery
        ? [
            supportCommandSection,
            ...rootCommandPaletteSections,
          ]
        : [
            ...rootCommandPaletteSections,
            supportCommandSection,
          ]
  ).filter((section) => section.items.length > 0);
  const commandPaletteEmptyMessage =
    currentCommandPalettePage !== null
      ? `No matching project for a new ${
          createResourceLabelByPage[currentCommandPalettePage]
        }.`
      : "No matching command. Try `projects`, `rows`, `people`, or `help`.";
  const commandPaletteFooterPrimaryText =
    currentCommandPalettePage !== null
      ? "Enter creates in the selected project"
      : "Enter opens the selected item";
  const commandPaletteFooterSecondaryText =
    commandPaletteSupportSheet !== null
      ? "Esc closes the side panel first"
      : currentCommandPalettePage !== null
        ? "Esc or Backspace returns to actions"
        : "Cmd/Ctrl+K toggles this menu";
  const projectIdByChildId = useMemo(() => {
    const next = new Map<string, string>();

    for (const project of sidebarData.projects) {
      for (const child of project.children) {
        if (
          child.kind === "table" ||
          child.kind === "source" ||
          child.kind === "pipe"
        ) {
          next.set(child.id, project.id);
        }
      }
    }

    return next;
  }, [
    sidebarData.projects,
  ]);
  const defaultOpenKeys = useMemo(
    () =>
      buildDefaultSidebarOpenKeys({
        pathname,
        selectedProgramId,
        sidebarData,
        sidebarMode,
      }),
    [
      pathname,
      selectedProgramId,
      sidebarData,
      sidebarMode,
    ],
  );
  const previewOpenKeys = useMemo(() => {
    const next = new Set<string>();

    for (const descriptor of previewDescriptors) {
      if (
        descriptor.kind === "project" ||
        descriptor.kind === "table" ||
        descriptor.kind === "source" ||
        descriptor.kind === "pipe" ||
        descriptor.kind === "row" ||
        descriptor.kind === "column" ||
        descriptor.kind === "cell"
      ) {
        next.add("section:projects");
      }

      if (
        descriptor.kind === "program" ||
        descriptor.kind === "program-file" ||
        descriptor.kind === "program-version"
      ) {
        next.add("section:programs");
      }

      if (descriptor.kind === "project") {
        next.add(`node:${descriptor.projectId}`);
      }

      if (descriptor.kind === "table") {
        const projectId = projectIdByChildId.get(descriptor.tableId);

        if (projectId) {
          next.add(`node:${projectId}`);
        }
      }

      if (descriptor.kind === "source") {
        const projectId = projectIdByChildId.get(descriptor.sourceId);

        if (projectId) {
          next.add(`node:${projectId}`);
        }
      }

      if (descriptor.kind === "pipe") {
        const projectId = projectIdByChildId.get(descriptor.pipeId);

        if (projectId) {
          next.add(`node:${projectId}`);
        }
      }
    }

    return next;
  }, [
    previewDescriptors,
    projectIdByChildId,
  ]);
  const effectiveOpenKeys = useMemo(
    () =>
      new Set([
        ...applySidebarTreeState(defaultOpenKeys, sidebarTreeState),
        ...previewOpenKeys,
      ]),
    [
      defaultOpenKeys,
      previewOpenKeys,
      sidebarTreeState,
    ],
  );
  const isAnySidebarResizing = isAgentSidebarResizing || isResizing;
  const layoutGridColumns = `${
    sidebarMode === "collapsed" ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth
  }px minmax(0, 1fr) ${
    agentSidebarMode === "collapsed"
      ? COLLAPSED_AGENT_SIDEBAR_WIDTH
      : agentSidebarWidth
  }px`;

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

  const toggleAgentSidebar = () => {
    const nextMode = nextSidebarMode[agentSidebarMode];

    void fetch("/api/gui/sidebar-mode", {
      body: JSON.stringify({
        agentSidebarMode: nextMode,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    setAgentSidebarMode(nextMode);
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

  const persistAgentSidebarWidth = (nextWidth: number) => {
    void fetch("/api/gui/sidebar-mode", {
      body: JSON.stringify({
        agentSidebarWidth: clampAgentSidebarWidth(nextWidth),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  };

  const persistSidebarTreeState = (nextState: SidebarTreeState) => {
    void fetch("/api/gui/sidebar-mode", {
      body: JSON.stringify({
        treeState: nextState,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  };

  const toggleOpen = (key: string) => {
    setSidebarTreeState((current) => {
      const nextState = updateSidebarTreeStateForKey(
        current,
        key,
        !applySidebarTreeState(defaultOpenKeys, current).has(key),
        defaultOpenKeys,
      );

      persistSidebarTreeState(nextState);

      return nextState;
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

  const handleResizeStart = (event: ReactPointerEvent<HTMLHRElement>) => {
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

  const handleResizeMove = (event: ReactPointerEvent<HTMLHRElement>) => {
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

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLHRElement>) => {
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

  const finishAgentSidebarResize = () => {
    const resizeState = agentResizeStateRef.current;

    if (!resizeState) {
      return;
    }

    agentResizeHandleRef.current?.releasePointerCapture(resizeState.pointerId);
    agentResizeStateRef.current = null;
    setIsAgentSidebarResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    persistAgentSidebarWidth(agentSidebarWidthRef.current);
  };

  const handleAgentSidebarResizeStart = (
    event: ReactPointerEvent<HTMLHRElement>,
  ) => {
    if (agentSidebarMode === "collapsed") {
      return;
    }

    agentResizeStateRef.current = {
      pointerId: event.pointerId,
      startWidth: agentSidebarWidth,
      startX: event.clientX,
    };
    setIsAgentSidebarResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleAgentSidebarResizeMove = (
    event: ReactPointerEvent<HTMLHRElement>,
  ) => {
    const resizeState = agentResizeStateRef.current;

    if (!resizeState) {
      return;
    }

    const nextWidth = clampAgentSidebarWidth(
      resizeState.startWidth - (event.clientX - resizeState.startX),
    );

    agentSidebarWidthRef.current = nextWidth;
    setAgentSidebarWidth(nextWidth);
  };

  const handleAgentSidebarResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLHRElement>,
  ) => {
    let nextWidth: number | null = null;

    if (event.key === "ArrowLeft") {
      nextWidth = clampAgentSidebarWidth(agentSidebarWidthRef.current + 16);
    } else if (event.key === "ArrowRight") {
      nextWidth = clampAgentSidebarWidth(agentSidebarWidthRef.current - 16);
    } else if (event.key === "Home") {
      nextWidth = clampAgentSidebarWidth(0);
    } else if (event.key === "End") {
      nextWidth = clampAgentSidebarWidth(Number.MAX_SAFE_INTEGER);
    }

    if (nextWidth === null) {
      return;
    }

    event.preventDefault();
    agentSidebarWidthRef.current = nextWidth;
    setAgentSidebarWidth(nextWidth);
    persistAgentSidebarWidth(nextWidth);
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

  const applySidebarBroadcast = (mutation: unknown) => {
    if (!isSidebarMutation(mutation)) {
      return;
    }

    setSidebarData((current) => applySidebarMutation(current, mutation));
  };

  usePrivateBroadcast({
    event: "sidebar_mutation",
    label: "GUI sidebar",
    onMessage: applySidebarBroadcast,
    topic: guiSidebarUserTopic(userId),
  });
  usePrivateBroadcast({
    event: "sidebar_mutation",
    label: "GUI sidebar",
    onMessage: applySidebarBroadcast,
    topic: GUI_SIDEBAR_FIRST_PARTY_PROGRAMS_TOPIC,
  });

  useEffect(
    () => () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    [],
  );

  useEffect(() => {
    agentSidebarWidthRef.current = agentSidebarWidth;
  }, [
    agentSidebarWidth,
  ]);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [
    sidebarWidth,
  ]);

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

  const renderTree = (nodes: SidebarTreeNode[]) =>
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
            onToggle={() => toggleOpen(nodeKey)}
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
              <MarbleAccountPopover
                avatarUrl={userAvatarUrl ?? undefined}
                className={cx(sidebar.iconOnly ? null : "flex-1")}
                compact={sidebar.iconOnly}
                description={userEmail ?? undefined}
                displayName={userDisplayName}
                name={userDisplayName}
                sections={accountMenuSections}
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
                        onToggle={() => toggleOpen(sectionKey)}
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
          <hr
            aria-controls="gui-navigation-sidebar"
            aria-label="Resize navigation sidebar"
            aria-orientation="vertical"
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuenow={sidebarWidth}
            className={cx(
              "absolute top-0 right-0 z-10 h-full w-3 translate-x-1/2 cursor-col-resize touch-none border-0 bg-linear-to-r from-transparent via-transparent to-transparent transition-colors",
              isResizing
                ? "via-taupe-400"
                : "hover:via-taupe-300 focus-visible:via-taupe-300",
            )}
            onKeyDown={handleResizeKeyDown}
            onPointerCancel={finishResize}
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={finishResize}
            ref={resizeHandleRef}
            tabIndex={0}
            title="Resize navigation sidebar"
          />
        )}
      </div>

      <main className="bg-transparent p-2 pb-8">
        <div className="size-full overflow-hidden rounded-md border border-taupe-200 bg-taupe-50 shadow-md">
          {children}
        </div>
      </main>

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
            <ChangeRadar
              className="min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none"
              headerActions={
                <button
                  aria-label={agentSidebarToggleLabel}
                  className="flex size-8 items-center justify-center rounded-md text-taupe-500 transition-colors hover:bg-taupe-200/80 hover:text-taupe-900"
                  onClick={toggleAgentSidebar}
                  title={agentSidebarToggleLabel}
                  type="button"
                >
                  <XIcon
                    size={16}
                    weight="bold"
                  />
                </button>
              }
              sidebarData={sidebarData}
            />
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
            onKeyDown={handleAgentSidebarResizeKeyDown}
            onPointerCancel={finishAgentSidebarResize}
            onPointerDown={handleAgentSidebarResizeStart}
            onPointerMove={handleAgentSidebarResizeMove}
            onPointerUp={finishAgentSidebarResize}
            ref={agentResizeHandleRef}
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
            onToggleSidebar={toggleAgentSidebar}
            sidebarData={sidebarData}
          />
        </div>
      ) : null}

      <ChangeSpotlight />

      <MarbleCommandDialog
        label="Global command palette"
        loop
        onKeyDown={handleCommandPaletteKeyDown}
        onOpenChange={handleCommandPaletteOpenChange}
        open={isCommandPaletteOpen}
      >
        <MarbleCommandInput
          onValueChange={setCommandPaletteQuery}
          placeholder="Search projects, programs, profiles, or help..."
          value={commandPaletteQuery}
        />
        <MarbleCommandList>
          <MarbleCommandEmpty>{commandPaletteEmptyMessage}</MarbleCommandEmpty>

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
                    <span className="font-mono text-eyebrow-xs text-taupe-400">
                      {item.detail}
                    </span>
                  </MarbleCommandItem>
                ))}
              </MarbleCommandGroup>
            </div>
          ))}
        </MarbleCommandList>

        <div className="flex items-center justify-between border-t border-taupe-200 bg-linear-to-t from-taupe-200 via-white to-white px-4 py-2 text-eyebrow text-taupe-500">
          <span>{commandPaletteFooterPrimaryText}</span>
          <span>{commandPaletteFooterSecondaryText}</span>
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
