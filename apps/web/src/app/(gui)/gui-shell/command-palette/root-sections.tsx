import {
  BookOpenTextIcon,
  BriefcaseMetalIcon,
  FileCodeIcon,
  FunnelIcon,
  IdentificationBadgeIcon,
  KeyIcon,
  LifebuoyIcon,
  PipeIcon,
  RobotIcon,
  TableIcon,
} from "@phosphor-icons/react";
import type { CommandPaletteSection, SupportSheetView } from "../types";
import type { CommandPaletteActions } from "./actions";

type RootCommandPaletteSectionsParams = {
  actions: CommandPaletteActions;
  onOpenSupportSheet: (view: SupportSheetView) => void;
};

export const buildSupportCommandSection = ({
  onOpenSupportSheet,
}: Pick<RootCommandPaletteSectionsParams, "onOpenSupportSheet">) =>
  ({
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
        onSelect: () => onOpenSupportSheet("handbook"),
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
        onSelect: () => onOpenSupportSheet("contact"),
      },
    ],
  }) satisfies CommandPaletteSection;

export const buildRootCommandPaletteSections = ({
  actions,
}: RootCommandPaletteSectionsParams): CommandPaletteSection[] => [
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
          void actions.handleCreateProjectFromCommandPalette();
        },
      },
      ...(actions.hasProjectTargetsForNewTable
        ? [
            {
              detail: actions.createTableDetail,
              icon: (
                <TableIcon
                  size={16}
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
              label: actions.defaultTableProjectNode
                ? "New table"
                : "New table...",
              onSelect: () => {
                void actions.handleCreateTableFromCommandPalette();
              },
            },
          ]
        : []),
      ...(actions.hasProjectTargetsForNewSource
        ? [
            {
              detail: actions.createSourceDetail,
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
              label: actions.defaultSourceProjectNode
                ? "New source"
                : "New source...",
              onSelect: () => {
                void actions.handleCreateSourceFromCommandPalette();
              },
            },
          ]
        : []),
      ...(actions.hasProjectTargetsForNewPipe
        ? [
            {
              detail: actions.createPipeDetail,
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
              label: actions.defaultPipeProjectNode
                ? "New pipe"
                : "New pipe...",
              onSelect: () => {
                void actions.handleCreatePipeFromCommandPalette();
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
          void actions.handleCreateProgramFromCommandPalette();
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
        onSelect: () => actions.navigateFromCommandPalette("/projects"),
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
        onSelect: () => actions.navigateFromCommandPalette("/programs"),
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
        onSelect: () => actions.navigateFromCommandPalette("/secrets"),
      },
    ],
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
        onSelect: () => actions.navigateFromCommandPalette("/profiles"),
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
        onSelect: () => actions.navigateFromCommandPalette("/automations"),
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
        onSelect: () => actions.navigateFromCommandPalette("/events"),
      },
    ],
  },
];
