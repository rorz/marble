"use client";

import {
  ArrowRightStartOnRectangleIcon,
  CircleStackIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
  cx,
  MarbleActivityRadar,
  MarbleActivityRadarPanel,
  MarbleActivityRadarTrigger,
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardFooter,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleCommandDialog,
  MarbleCommandEmpty,
  MarbleCommandGroup,
  MarbleCommandInput,
  MarbleCommandItem,
  MarbleCommandList,
  MarbleCommandMenu,
  MarbleCommandSeparator,
  MarbleContextPopover,
  type MarbleContextPopoverSection,
  MarbleDropzone,
  MarbleEditableText,
  MarbleEmptyState,
  MarbleFieldLabel,
  MarbleInput,
  MarbleListRow,
  MarbleModal,
  MarbleModalContent,
  MarbleModalDescription,
  MarbleModalFooter,
  MarbleModalHeader,
  MarbleModalTitle,
  MarblePane,
  MarblePaneEditableCrumb,
  MarbleProfileAttribution,
  MarbleReviewNavigator,
  MarbleSearchSelect,
  type MarbleSearchSelectOption,
  MarbleSelect,
  MarbleSheet,
  MarbleSheetClose,
  MarbleSheetContent,
  MarbleSheetDescription,
  MarbleSheetFooter,
  MarbleSheetHeader,
  MarbleSheetTitle,
  MarbleTextarea,
  MarbleWorkbenchResizeHandle,
  MarbleWorkbenchSection,
  MarbleWorkbenchTab,
  MarbleWorkbenchTabs,
  MarbleWorkspaceMark,
  MarbleWorkspacePopover,
  marbleToast,
} from "@marble/ui";
import {
  ArrowRightIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react/ssr";
import { type ReactNode, useState } from "react";

const badgeTones = [
  "neutral",
  "warning",
  "info",
  "error",
  "solid",
  "success",
] as const;

const alertTones = [
  "neutral",
  "success",
  "warning",
  "error",
] as const;

const buttonVariants = [
  {
    children: "Add Row",
    label: "Default",
    variant: "light",
  },
  {
    children: "Inspect",
    label: "Dark",
    variant: "dark",
  },
  {
    children: "Run All",
    label: "Orange",
    variant: "orange",
  },
  {
    children: "Delete",
    label: "Red",
    variant: "red",
  },
] as const;

const inputSizes = [
  "md",
  "sm",
  "xs",
] as const;

const selectSizes = [
  "md",
  "sm",
  "xs",
] as const;

const textareaSizes = [
  "md",
  "sm",
  "xs",
] as const;

const sheetSides = [
  "right",
  "left",
  "top",
  "bottom",
] as const;

const modalSizes = [
  "sm",
  "md",
  "lg",
] as const;

type SheetSide = (typeof sheetSides)[number];
type ModalSize = (typeof modalSizes)[number];

const sectionLinks = [
  {
    id: "actions",
    label: "Actions",
  },
  {
    id: "surfaces",
    label: "Surfaces",
  },
  {
    id: "forms",
    label: "Forms",
  },
  {
    id: "uploads",
    label: "Uploads",
  },
  {
    id: "navigation",
    label: "Navigation",
  },
  {
    id: "menus",
    label: "Menus",
  },
  {
    id: "commands",
    label: "Commands",
  },
  {
    id: "overlays",
    label: "Overlays",
  },
] as const;

const providerOptions = [
  {
    label: "Codex (default)",
    value: "Codex",
  },
  {
    label: "Claude Code",
    value: "Claude Code",
  },
  {
    label: "OpenCode",
    value: "OpenCode",
  },
  {
    label: "Gemini CLI",
    value: "Gemini CLI",
  },
] satisfies MarbleSearchSelectOption[];

function Section({
  children,
  description,
  id,
  title,
}: Readonly<{
  children: ReactNode;
  description: string;
  id: string;
  title: string;
}>) {
  return (
    <section
      className="scroll-mt-6"
      id={id}
    >
      <MarbleCard>
        <MarbleCardHeader className="gap-1 pb-4">
          <MarbleCardTitle className="text-lg text-taupe-950">
            {title}
          </MarbleCardTitle>
          <MarbleCardDescription className="max-w-3xl text-taupe-600">
            {description}
          </MarbleCardDescription>
        </MarbleCardHeader>
        <MarbleCardContent className="space-y-4 pt-5">
          {children}
        </MarbleCardContent>
      </MarbleCard>
    </section>
  );
}

function DemoPanel({
  children,
  className,
  contentClassName,
  description,
  title,
  tone = "default",
}: Readonly<{
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: string;
  title: string;
  tone?: "default" | "orange" | "subtle";
}>) {
  return (
    <MarbleCard
      className={className}
      tone={tone}
    >
      <MarbleCardHeader className="gap-1 pb-4">
        <MarbleCardTitle>{title}</MarbleCardTitle>
        {description ? (
          <MarbleCardDescription>{description}</MarbleCardDescription>
        ) : null}
      </MarbleCardHeader>
      <MarbleCardContent className={contentClassName}>
        {children}
      </MarbleCardContent>
    </MarbleCard>
  );
}

export default function UiPage() {
  const defaultProjectName = "Untitled Project";
  const defaultCrumbName = "Audience Enrichment";
  const [editableValue, setEditableValue] = useState(defaultProjectName);
  const [editableCrumbValue, setEditableCrumbValue] =
    useState(defaultCrumbName);
  const [isEditingCrumb, setIsEditingCrumb] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isCommandDialogOpen, setIsCommandDialogOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSize, setModalSize] = useState<ModalSize>("md");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetSide, setSheetSide] = useState<SheetSide>("right");
  const [multiDropzoneSummary, setMultiDropzoneSummary] = useState(
    "No files selected yet",
  );
  const [singleDropzoneSummary, setSingleDropzoneSummary] = useState(
    "Drop one file to preview its name",
  );
  const [selectedCommandExample, setSelectedCommandExample] =
    useState("Open projects");
  const [lastInteraction, setLastInteraction] = useState("Waiting for input");
  const [reviewNavigatorIndex, setReviewNavigatorIndex] = useState(1);
  const [workbenchTabs, setWorkbenchTabs] = useState([
    "input-schema.json",
    "main.ts",
    "package.json",
  ]);
  const [activeWorkbenchTab, setActiveWorkbenchTab] =
    useState("input-schema.json");
  const [isWorkbenchVersionsCollapsed, setIsWorkbenchVersionsCollapsed] =
    useState(false);
  const [isWorkbenchDraftCollapsed, setIsWorkbenchDraftCollapsed] =
    useState(false);

  const handleMenuSelect = (label: string) => {
    setLastInteraction(label);
  };

  const handleCommandSelect = (
    label: string,
    options?: {
      closeDialog?: boolean;
    },
  ) => {
    setSelectedCommandExample(label);
    setLastInteraction(label);

    if (options?.closeDialog) {
      setIsCommandDialogOpen(false);
    }
  };

  const handleWorkbenchTabClose = (filename: string) => {
    setWorkbenchTabs((current) => {
      const currentIndex = current.indexOf(filename);

      if (currentIndex === -1) {
        return current;
      }

      const nextTabs = current.filter((tab) => tab !== filename);

      setActiveWorkbenchTab((currentActiveTab) =>
        currentActiveTab === filename
          ? (nextTabs[currentIndex] ?? nextTabs[currentIndex - 1] ?? "")
          : currentActiveTab,
      );

      return nextTabs;
    });
  };

  const utilitySections: MarbleContextPopoverSection[] = [
    {
      id: "utility-primary",
      items: [
        {
          icon: <Cog6ToothIcon className="h-4 w-4" />,
          id: "utility-settings",
          label: "Settings",
          onSelect: () => handleMenuSelect("Settings"),
        },
        {
          description: "Disabled items stay in the list for discoverability.",
          disabled: true,
          icon: <CircleStackIcon className="h-4 w-4" />,
          id: "utility-billing",
          label: "Billing",
          onSelect: () => handleMenuSelect("Billing"),
        },
      ],
    },
    {
      id: "utility-secondary",
      items: [
        {
          detail: "Docs",
          icon: <QuestionMarkCircleIcon className="h-4 w-4" />,
          id: "utility-help",
          label: "Help",
          onSelect: () => handleMenuSelect("Help"),
        },
        {
          icon: <ArrowRightStartOnRectangleIcon className="h-4 w-4" />,
          id: "utility-sign-out",
          label: "Sign out",
          onSelect: () => handleMenuSelect("Sign out"),
          tone: "danger",
        },
      ],
    },
  ];

  const workspaceSections: MarbleContextPopoverSection[] = [
    {
      id: "workspace-primary",
      items: [
        {
          icon: <UserGroupIcon className="h-4 w-4" />,
          id: "workspace-team",
          label: "Team directory",
          onSelect: () => handleMenuSelect("Team directory"),
        },
        {
          icon: <Squares2X2Icon className="h-4 w-4" />,
          id: "workspace-apps",
          label: "Apps and integrations",
          onSelect: () => handleMenuSelect("Apps and integrations"),
        },
      ],
    },
    {
      id: "workspace-secondary",
      items: [
        {
          detail: "Default",
          icon: <SparklesIcon className="h-4 w-4" />,
          id: "workspace-brand",
          label: "Workspace appearance",
          onSelect: () => handleMenuSelect("Workspace appearance"),
        },
        {
          icon: <Cog6ToothIcon className="h-4 w-4" />,
          id: "workspace-settings",
          label: "Workspace settings",
          onSelect: () => handleMenuSelect("Workspace settings"),
        },
        {
          icon: <ArrowRightStartOnRectangleIcon className="h-4 w-4" />,
          id: "workspace-sign-out",
          label: "Sign out",
          onSelect: () => handleMenuSelect("Workspace sign out"),
          tone: "danger",
        },
      ],
    },
  ];
  const activityRadarBatches = [
    {
      actors: [
        {
          externalName: "Claude Code",
          icon: "🛠️",
          id: "profile-claude",
          name: "Schema Agent",
          type: "Agent" as const,
        },
      ],
      description: "+1 ~14 · 1 Table · 14 Cells",
      id: "activity-radar-prospects",
      label: "Prospects",
      onSelect: () => handleMenuSelect("Agent changesets: Prospects"),
      segments: [
        {
          tone: "create" as const,
          value: 1,
        },
        {
          tone: "update" as const,
          value: 14,
        },
      ],
      timestampLabel: "Just now",
      unread: true,
    },
    {
      actors: [
        {
          externalName: "Codex",
          icon: "🤖",
          id: "profile-codex",
          name: "Build Agent",
          type: "Agent" as const,
        },
        {
          externalName: "Cursor",
          icon: "🔍",
          id: "profile-cursor",
          name: "Review Agent",
          type: "Agent" as const,
        },
      ],
      description: "~4 -1 · 4 Columns · 1 Row",
      id: "activity-radar-pipeline",
      label: "Pipeline",
      onSelect: () => handleMenuSelect("Agent changesets: Pipeline"),
      segments: [
        {
          tone: "update" as const,
          value: 4,
        },
        {
          tone: "delete" as const,
          value: 1,
        },
      ],
      timestampLabel: "12m ago",
    },
  ];

  const renderCommandMenu = (closeDialog = false) => (
    <>
      <MarbleCommandInput placeholder="Search projects, docs, or support..." />
      <MarbleCommandList>
        <MarbleCommandEmpty>No matching command.</MarbleCommandEmpty>

        <MarbleCommandGroup heading="Workspace">
          <MarbleCommandItem
            keywords={[
              "projects",
              "folders",
            ]}
            onSelect={() =>
              handleCommandSelect("Open projects", {
                closeDialog,
              })
            }
            value="Open projects"
          >
            <FolderOpenIcon className="h-4 w-4 text-orange-600" />
            <span className="flex-1">Open projects</span>
          </MarbleCommandItem>
          <MarbleCommandItem
            keywords={[
              "profiles",
              "people",
            ]}
            onSelect={() =>
              handleCommandSelect("Browse profiles", {
                closeDialog,
              })
            }
            value="Browse profiles"
          >
            <UserGroupIcon className="h-4 w-4 text-emerald-600" />
            <span className="flex-1">Browse profiles</span>
          </MarbleCommandItem>
          <MarbleCommandItem
            disabled
            keywords={[
              "billing",
              "plan",
            ]}
            value="Billing"
          >
            <CircleStackIcon className="h-4 w-4" />
            <span className="flex-1">Billing</span>
          </MarbleCommandItem>
        </MarbleCommandGroup>

        <MarbleCommandSeparator />

        <MarbleCommandGroup heading="Support">
          <MarbleCommandItem
            keywords={[
              "help",
              "docs",
            ]}
            onSelect={() =>
              handleCommandSelect("Open help examples", {
                closeDialog,
              })
            }
            value="Open help examples"
          >
            <QuestionMarkCircleIcon className="h-4 w-4 text-violet-600" />
            <span className="flex-1">Open help examples</span>
          </MarbleCommandItem>
          <MarbleCommandItem
            keywords={[
              "logout",
              "exit",
            ]}
            onSelect={() =>
              handleCommandSelect("Sign out", {
                closeDialog,
              })
            }
            value="Sign out"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4 text-rose-600" />
            <span className="flex-1">Sign out</span>
          </MarbleCommandItem>
        </MarbleCommandGroup>
      </MarbleCommandList>
    </>
  );

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-taupe-800">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="space-y-3">
          <p className="font-medium text-[11px] text-orange-600 uppercase tracking-[0.24em]">
            Marble UI
          </p>
          <h1 className="font-semibold text-3xl tracking-tight text-taupe-950">
            Kitchen Sink
          </h1>
          <p className="max-w-2xl text-sm text-taupe-600">
            Full variant coverage for the shared `@marble/ui` primitives, with
            the page flattened back into a simpler single-column reference.
          </p>
          <div className="flex flex-wrap gap-2">
            {sectionLinks.map((link) => (
              <a
                className="rounded-xs border border-taupe-200 bg-white px-3 py-1.5 font-medium text-xs text-taupe-700 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                href={`#${link.id}`}
                key={link.id}
              >
                {link.label}
              </a>
            ))}
          </div>
        </header>

        <Section
          description="Buttons, badges, and alerts now show every tone, the shipped size transitions, and the standard icon slots instead of only the happy path."
          id="actions"
          title="Actions"
        >
          <div className="space-y-4">
            <DemoPanel
              description="Every button variant in all shipped sizes, plus disabled states and standardized phosphor icon slots."
              title="Buttons"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="font-medium text-[11px] text-taupe-500 uppercase tracking-[0.24em]">
                    Medium
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {buttonVariants.map((button) => (
                      <MarbleButton
                        key={`md-${button.label}`}
                        variant={button.variant}
                      >
                        {button.children}
                      </MarbleButton>
                    ))}
                    <MarbleButton
                      disabled
                      variant="orange"
                    >
                      Running…
                    </MarbleButton>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium text-[11px] text-taupe-500 uppercase tracking-[0.24em]">
                    Small
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {buttonVariants.map((button) => (
                      <MarbleButton
                        key={`sm-${button.label}`}
                        size="sm"
                        variant={button.variant}
                      >
                        {button.children}
                      </MarbleButton>
                    ))}
                    <MarbleButton
                      disabled
                      size="sm"
                      variant="dark"
                    >
                      Disabled
                    </MarbleButton>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium text-[11px] text-taupe-500 uppercase tracking-[0.24em]">
                    Extra Small
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {buttonVariants.map((button) => (
                      <MarbleButton
                        key={`xs-${button.label}`}
                        size="xs"
                        variant={button.variant}
                      >
                        {button.children}
                      </MarbleButton>
                    ))}
                    <MarbleButton
                      disabled
                      size="xs"
                      variant="dark"
                    >
                      Disabled
                    </MarbleButton>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium text-[11px] text-taupe-500 uppercase tracking-[0.24em]">
                    With icons
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <MarbleButton iconLeft={PlusIcon}>Add Row</MarbleButton>
                    <MarbleButton
                      iconRight={ArrowRightIcon}
                      variant="dark"
                    >
                      Inspect
                    </MarbleButton>
                    <MarbleButton
                      iconLeft={PlayIcon}
                      variant="orange"
                    >
                      Run All
                    </MarbleButton>
                    <MarbleButton
                      iconLeft={TrashIcon}
                      variant="red"
                    >
                      Delete
                    </MarbleButton>
                  </div>
                </div>
              </div>
            </DemoPanel>

            <DemoPanel
              description="Shared toast chrome for editor lifecycle nudges and background sync feedback."
              title="Toasts"
            >
              <div className="flex flex-wrap gap-3">
                <MarbleButton
                  onClick={() =>
                    marbleToast("Draft created", {
                      description:
                        "Forked from v12. Existing columns still use v12.",
                    })
                  }
                  size="sm"
                >
                  Show neutral toast
                </MarbleButton>
                <MarbleButton
                  onClick={() =>
                    marbleToast.success("Published v13", {
                      description:
                        "Existing columns stay pinned until you update them.",
                    })
                  }
                  size="sm"
                  variant="orange"
                >
                  Show success toast
                </MarbleButton>
              </div>
            </DemoPanel>

            <DemoPanel
              description="Status tones with both badge casing modes and alert sizes."
              title="Badges and alerts"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {badgeTones.map((tone) => (
                    <MarbleBadge
                      caps
                      key={`caps-${tone}`}
                      tone={tone}
                    >
                      {tone}
                    </MarbleBadge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {badgeTones.map((tone) => (
                    <MarbleBadge
                      key={`plain-${tone}`}
                      tone={tone}
                    >
                      {tone}
                    </MarbleBadge>
                  ))}
                </div>
                <div className="grid gap-2">
                  {alertTones.map((tone) => (
                    <div
                      className="grid gap-2 lg:grid-cols-[1fr_auto]"
                      key={tone}
                    >
                      <MarbleAlert tone={tone}>
                        {tone} feedback for dense workspace UI.
                      </MarbleAlert>
                      <MarbleAlert
                        size="sm"
                        tone={tone}
                      >
                        {tone}
                      </MarbleAlert>
                    </div>
                  ))}
                </div>
              </div>
            </DemoPanel>
          </div>
        </Section>

        <Section
          description="Card tones, empty states, and surface framing all live here now so the route reads like a catalog instead of a scratchpad."
          id="surfaces"
          title="Surfaces"
        >
          <div className="space-y-4">
            <DemoPanel
              description="All three card tones with real footer and content treatments."
              title="Cards"
              tone="default"
            >
              <div className="space-y-4">
                <MarbleCard>
                  <MarbleCardHeader>
                    <MarbleCardTitle>Default</MarbleCardTitle>
                    <MarbleCardDescription>
                      Neutral chrome for routine workspace panels.
                    </MarbleCardDescription>
                  </MarbleCardHeader>
                  <MarbleCardContent>
                    <div className="rounded-xs border border-taupe-200 bg-taupe-50 p-3 text-sm text-taupe-600">
                      128 rows synced
                    </div>
                  </MarbleCardContent>
                  <MarbleCardFooter>
                    <MarbleButton size="sm">Inspect</MarbleButton>
                  </MarbleCardFooter>
                </MarbleCard>

                <MarbleCard>
                  <MarbleCardHeader
                    actions={[
                      {
                        children: "Create key",
                        size: "sm",
                        variant: "dark",
                      },
                    ]}
                    disclosureActions={[
                      {
                        label: "Rename profile",
                        onSelect: () => undefined,
                      },
                      {
                        label: "Delete profile",
                        onSelect: () => undefined,
                        tone: "danger",
                      },
                    ]}
                  >
                    <MarbleCardTitle>Action Header</MarbleCardTitle>
                    <MarbleCardDescription>
                      Standardized inline buttons and disclosure menus now live
                      in the shared header API.
                    </MarbleCardDescription>
                  </MarbleCardHeader>
                  <MarbleCardContent>
                    <div className="rounded-xs border border-taupe-200 bg-taupe-50 p-3 text-sm text-taupe-600">
                      Use inline actions for primary moves and disclosure items
                      for the destructive or secondary ones.
                    </div>
                  </MarbleCardContent>
                </MarbleCard>

                <MarbleCard tone="subtle">
                  <MarbleCardHeader>
                    <MarbleCardTitle>Subtle</MarbleCardTitle>
                    <MarbleCardDescription>
                      Low-contrast framing for dense controls.
                    </MarbleCardDescription>
                  </MarbleCardHeader>
                  <MarbleCardContent className="space-y-2">
                    <MarbleFieldLabel>Table name</MarbleFieldLabel>
                    <MarbleInput
                      defaultValue="Prospects"
                      wrapperClassName="w-full"
                    />
                  </MarbleCardContent>
                </MarbleCard>

                <MarbleCard tone="orange">
                  <MarbleCardHeader>
                    <MarbleCardTitle>Orange</MarbleCardTitle>
                    <MarbleCardDescription>
                      Accent treatment for active or promoted surfaces.
                    </MarbleCardDescription>
                  </MarbleCardHeader>
                  <MarbleCardContent>
                    <div className="rounded-xs border border-orange-200 bg-white/80 p-3 text-sm text-taupe-700">
                      14 runnable columns ready
                    </div>
                  </MarbleCardContent>
                  <MarbleCardFooter>
                    <MarbleButton
                      size="sm"
                      variant="orange"
                    >
                      Run all
                    </MarbleButton>
                  </MarbleCardFooter>
                </MarbleCard>
              </div>
            </DemoPanel>

            <DemoPanel
              description="Minimal and action-led empty states."
              title="Empty states"
            >
              <div className="space-y-4">
                <MarbleCard>
                  <MarbleCardContent>
                    <MarbleEmptyState
                      description="Create a project, then rename it inline from the project view."
                      icon={
                        <div className="flex size-10 items-center justify-center rounded-xs border border-orange-200 bg-orange-50 text-orange-700">
                          <FolderOpenIcon className="h-5 w-5" />
                        </div>
                      }
                      title="No projects yet"
                    />
                  </MarbleCardContent>
                </MarbleCard>

                <MarbleCard tone="subtle">
                  <MarbleCardContent>
                    <MarbleEmptyState
                      actions={
                        <MarbleButton
                          size="sm"
                          variant="orange"
                        >
                          Create profile
                        </MarbleButton>
                      }
                      description="This variant keeps the action aligned with the message."
                      icon={
                        <div className="flex size-10 items-center justify-center rounded-xs border border-taupe-200 bg-white text-taupe-700">
                          <UserGroupIcon className="h-5 w-5" />
                        </div>
                      }
                      title="No profiles yet"
                    />
                  </MarbleCardContent>
                </MarbleCard>
              </div>
            </DemoPanel>
          </div>
        </Section>

        <Section
          description="Form primitives now cover size variants, disabled states, select/search input paths, and both prose and code-style textareas."
          id="forms"
          title="Forms"
        >
          <div className="space-y-4">
            <DemoPanel
              description="Labels plus every input size."
              title="Inputs"
            >
              <div className="space-y-3">
                {inputSizes.map((size) => (
                  <div key={size}>
                    <MarbleFieldLabel>{size} input</MarbleFieldLabel>
                    <MarbleInput
                      defaultValue={`Sample ${size} value`}
                      size={size}
                      wrapperClassName="w-full"
                    />
                  </div>
                ))}
                <div>
                  <MarbleFieldLabel>Disabled input</MarbleFieldLabel>
                  <MarbleInput
                    defaultValue="Read only in this state"
                    disabled
                    wrapperClassName="w-full"
                  />
                </div>
              </div>
            </DemoPanel>

            <DemoPanel
              description="Selects and datalist-backed search selects."
              title="Selects"
            >
              <div className="space-y-3">
                {selectSizes.map((size) => (
                  <div key={size}>
                    <MarbleFieldLabel>{size} select</MarbleFieldLabel>
                    <MarbleSelect
                      defaultValue="uppercase"
                      size={size}
                      wrapperClassName="w-full"
                    >
                      <option value="uppercase">Uppercase String</option>
                      <option value="formula">Formula</option>
                      <option value="http-request">HTTP Request</option>
                    </MarbleSelect>
                  </div>
                ))}

                <div>
                  <MarbleFieldLabel>Search select</MarbleFieldLabel>
                  <MarbleSearchSelect
                    defaultValue="Codex"
                    options={providerOptions}
                    placeholder="Search or select a provider"
                    wrapperClassName="w-full"
                  />
                </div>
              </div>
            </DemoPanel>

            <DemoPanel
              description="Default prose entry and monospace code entry."
              title="Textareas"
            >
              <div className="space-y-3">
                {textareaSizes.map((size) => (
                  <div key={size}>
                    <MarbleFieldLabel>{size} textarea</MarbleFieldLabel>
                    <MarbleTextarea
                      defaultValue={
                        size === "xs"
                          ? `{\n  "companyName.$": "$.columns.company.value",\n  "tone": "warm"\n}`
                          : "A reusable textarea should stay calm on prose and dense structured content."
                      }
                      monospace={size === "xs"}
                      rows={size === "xs" ? 6 : 3}
                      size={size}
                      wrapperClassName="w-full"
                    />
                  </div>
                ))}
              </div>
            </DemoPanel>
          </div>
        </Section>

        <Section
          description="File entry and inline rename states are grouped together here because they both need a little harnessing to read correctly."
          id="uploads"
          title="Uploads"
        >
          <div className="space-y-4">
            <DemoPanel
              description="Neutral, orange, compact, and disabled states."
              title="Dropzones"
            >
              <div className="space-y-4">
                <MarbleDropzone
                  accept=".ts,.json,.md"
                  description="Multiple file uploads keep the fuller orange treatment."
                  hint={multiDropzoneSummary}
                  icon={<CodeBracketIcon className="h-5 w-5" />}
                  multiple
                  onFilesChange={(files) => {
                    setMultiDropzoneSummary(
                      files.length === 0
                        ? "No files selected yet"
                        : files.length === 1
                          ? `Selected ${files[0]?.name}`
                          : `Selected ${files.length} files`,
                    );
                  }}
                  title="Import program files"
                  tone="orange"
                />

                <MarbleDropzone
                  accept=".csv,.json"
                  description="Compact dropzone for inline forms."
                  hint={singleDropzoneSummary}
                  icon={<DocumentTextIcon className="h-5 w-5" />}
                  onFilesChange={(files) => {
                    setSingleDropzoneSummary(
                      files[0]?.name ?? "Drop one file to preview its name",
                    );
                  }}
                  size="sm"
                  title="Upload a single file"
                />

                <MarbleDropzone
                  description="Use the disabled state while uploads are unavailable."
                  disabled
                  hint="Connect a workspace or enable uploads to activate."
                  icon={<FolderOpenIcon className="h-5 w-5" />}
                  title="Uploads unavailable"
                />
              </div>
            </DemoPanel>

            <DemoPanel
              description="Title, crumb, and disabled inline rename surfaces."
              title="Editable text"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-1">
                  <span className="rounded-sm px-1.5 py-1 font-medium text-base text-taupe-800">
                    Projects
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-taupe-300"
                  >
                    &gt;
                  </span>
                  <MarblePaneEditableCrumb
                    editing={isEditingCrumb}
                    onCancel={() => {
                      setEditableCrumbValue(defaultCrumbName);
                      setIsEditingCrumb(false);
                    }}
                    onChange={setEditableCrumbValue}
                    onCommit={() => setIsEditingCrumb(false)}
                    onEdit={() => setIsEditingCrumb(true)}
                    value={editableCrumbValue}
                  />
                </div>

                <MarbleEditableText
                  className="-mx-1 rounded-sm px-1 text-left text-3xl tracking-tight text-zinc-950 transition-colors hover:text-orange-600"
                  editing={isEditingName}
                  onCancel={() => {
                    setEditableValue(defaultProjectName);
                    setIsEditingName(false);
                  }}
                  onChange={setEditableValue}
                  onCommit={() => setIsEditingName(false)}
                  onEdit={() => setIsEditingName(true)}
                  value={editableValue}
                />

                <div>
                  <MarbleFieldLabel>Disabled</MarbleFieldLabel>
                  <MarbleEditableText
                    className="rounded-sm px-1 text-base text-taupe-800"
                    disabled
                    editing={false}
                    onCancel={() => undefined}
                    onChange={() => undefined}
                    onCommit={() => undefined}
                    onEdit={() => undefined}
                    value="Locked project name"
                  />
                </div>
              </div>
            </DemoPanel>
          </div>
        </Section>

        <Section
          description="Rows and panes now show the primary size, tone, width, and action combinations instead of only one demo path."
          id="navigation"
          title="Navigation"
        >
          <div className="space-y-4">
            <DemoPanel
              description="Compact, small, active, orange, and aside variants."
              title="List rows"
            >
              <MarbleCard>
                <MarbleCardContent className="p-0">
                  <MarbleListRow
                    description="Compact layout for list-heavy surfaces."
                    icon={
                      <div className="mt-0.5 flex size-8 items-center justify-center rounded-xs border border-orange-200 bg-orange-50 text-orange-700">
                        <CodeBracketIcon className="h-4 w-4" />
                      </div>
                    }
                    meta={
                      <span className="font-mono text-[11px] text-zinc-500">
                        v8
                      </span>
                    }
                    size="compact"
                    title="Audience enrichment"
                    tone="orange"
                  />
                  <MarbleListRow
                    active
                    aside={<MarbleBadge tone="info">Selected</MarbleBadge>}
                    description="Small active row with inline aside."
                    icon={<CodeBracketIcon className="h-4 w-4 text-sky-600" />}
                    size="sm"
                    title="runner.ts"
                  />
                  <MarbleListRow
                    align="start"
                    description="Default density with start alignment and disabled treatment."
                    disabled
                    icon={<CommandLineIcon className="h-4 w-4 text-zinc-500" />}
                    title="Archived command"
                  />
                </MarbleCardContent>
              </MarbleCard>
            </DemoPanel>

            <DemoPanel
              description="Full-width, narrow, and flush pane layouts with shared chrome."
              title="Pane"
            >
              <div className="space-y-4">
                <div className="h-80 overflow-hidden rounded-sm border border-taupe-200 bg-taupe-50 shadow-sm">
                  <MarblePane
                    actions={[
                      {
                        children: "Create",
                        id: "pane-create",
                        variant: "orange",
                      },
                      {
                        children: "Inspect",
                        id: "pane-inspect",
                        variant: "dark",
                      },
                    ]}
                    crumbs={[
                      {
                        href: "/projects",
                        id: "pane-projects",
                        label: "Projects",
                      },
                      {
                        id: "pane-current",
                        label: "Untitled Project",
                      },
                    ]}
                  >
                    <MarbleCard>
                      <MarbleCardHeader>
                        <MarbleCardTitle>Full width</MarbleCardTitle>
                        <MarbleCardDescription>
                          Breadcrumbs, actions, and scroll framing stay in the
                          shared primitive.
                        </MarbleCardDescription>
                      </MarbleCardHeader>
                    </MarbleCard>
                  </MarblePane>
                </div>

                <div className="h-80 overflow-hidden rounded-sm border border-taupe-200 bg-white shadow-sm">
                  <MarblePane
                    actions={[
                      {
                        children: "Inspect",
                        id: "pane-flush-inspect",
                        variant: "dark",
                      },
                    ]}
                    crumbs={[
                      {
                        href: "/tables",
                        id: "pane-tables",
                        label: "Tables",
                      },
                      {
                        id: "pane-flush-current",
                        label: "Pipeline Runs",
                      },
                    ]}
                    frame="none"
                  >
                    <MarbleCard className="rounded-none border-x-0 shadow-none">
                      <MarbleCardHeader>
                        <MarbleCardTitle>Flush frame</MarbleCardTitle>
                        <MarbleCardDescription>
                          Remove the pane inset when the content should sit
                          directly against the surrounding shell while the
                          breadcrumb rail keeps its normal chrome.
                        </MarbleCardDescription>
                      </MarbleCardHeader>
                    </MarbleCard>
                  </MarblePane>
                </div>

                <div className="h-80 overflow-hidden rounded-sm border border-taupe-200 bg-white shadow-sm">
                  <MarblePane
                    description="A narrower reading column for setup and detail pages."
                    title="Narrow pane"
                    width="Narrow"
                  >
                    <MarbleCard tone="subtle">
                      <MarbleCardHeader>
                        <MarbleCardTitle>Focused content</MarbleCardTitle>
                        <MarbleCardDescription>
                          The narrow width keeps long-form setup content more
                          legible.
                        </MarbleCardDescription>
                      </MarbleCardHeader>
                    </MarbleCard>
                  </MarblePane>
                </div>
              </div>
            </DemoPanel>

            <DemoPanel
              description="Dense editor surfaces can now reuse collapsible workbench sections, resize handles, and closeable tab strips instead of improvising bespoke chrome."
              title="Workbench"
            >
              <div className="overflow-hidden rounded-sm border border-taupe-200 bg-[linear-gradient(180deg,#f8f5ee_0%,#f4efe6_100%)] p-2 shadow-sm">
                <div className="grid gap-2 lg:grid-cols-[12rem_minmax(0,1fr)_15rem]">
                  <div className="flex min-h-0 flex-col rounded-sm border border-taupe-300 bg-taupe-100/70">
                    <MarbleWorkbenchSection
                      badge={
                        <MarbleBadge className="font-mono">3 files</MarbleBadge>
                      }
                      bodyClassName="bg-transparent"
                      className="flex min-h-0 flex-1 flex-col rounded-none border-0 border-b border-taupe-300 bg-transparent shadow-none"
                      headerClassName="px-2 py-2"
                      icon={<FolderOpenIcon className="h-4 w-4" />}
                      title="Workspace"
                    >
                      <div className="space-y-px p-1.5 font-mono text-[11px]">
                        {[
                          "input-schema.json",
                          "main.ts",
                          "package.json",
                        ].map((filename) => (
                          <button
                            className={cx(
                              "flex h-7 w-full items-center gap-2 rounded-sm px-1.5 text-left transition-colors",
                              activeWorkbenchTab === filename
                                ? "bg-white text-taupe-950 shadow-[inset_2px_0_0_0_#f97316]"
                                : "text-taupe-700 hover:bg-white/70 hover:text-taupe-950",
                            )}
                            key={filename}
                            onClick={() => {
                              if (!workbenchTabs.includes(filename)) {
                                setWorkbenchTabs((current) => [
                                  ...current,
                                  filename,
                                ]);
                              }

                              setActiveWorkbenchTab(filename);
                            }}
                            type="button"
                          >
                            <DocumentTextIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                            <span className="truncate">{filename}</span>
                          </button>
                        ))}
                      </div>
                    </MarbleWorkbenchSection>

                    {isWorkbenchVersionsCollapsed ? null : (
                      <MarbleWorkbenchResizeHandle title="Resize preview" />
                    )}

                    <MarbleWorkbenchSection
                      badge={
                        <MarbleBadge className="font-mono">v8</MarbleBadge>
                      }
                      bodyStyle={{
                        height: 118,
                      }}
                      className="shrink-0 rounded-none border-0 bg-transparent shadow-none"
                      collapsed={isWorkbenchVersionsCollapsed}
                      collapsible
                      headerClassName="px-2 py-2"
                      icon={<SparklesIcon className="h-4 w-4" />}
                      onToggleCollapsed={() =>
                        setIsWorkbenchVersionsCollapsed((current) => !current)
                      }
                      title="Versions"
                    >
                      <div className="h-full space-y-px overflow-y-auto bg-transparent p-1.5">
                        {[
                          "v8 · Latest",
                          "v7 · 3 files",
                          "v6 · 2 files",
                        ].map((label) => (
                          <div
                            className="rounded-sm border border-taupe-200 bg-white/85 px-2 py-2 font-mono text-[11px] text-taupe-700"
                            key={label}
                          >
                            {label}
                          </div>
                        ))}
                      </div>
                    </MarbleWorkbenchSection>
                  </div>

                  <div className="overflow-hidden rounded-sm border border-taupe-300 bg-white">
                    <MarbleWorkbenchTabs>
                      {workbenchTabs.map((filename) => (
                        <MarbleWorkbenchTab
                          active={activeWorkbenchTab === filename}
                          dirty={filename === "main.ts"}
                          icon={
                            <DocumentTextIcon className="h-4 w-4 text-sky-600" />
                          }
                          key={filename}
                          label={filename}
                          onClose={() => handleWorkbenchTabClose(filename)}
                          onSelect={() => setActiveWorkbenchTab(filename)}
                        />
                      ))}
                    </MarbleWorkbenchTabs>
                    <div className="h-64 bg-white p-4 font-mono text-[12px] leading-6 text-taupe-800">
                      <pre>{`export default async function run(input) {\n  return {\n    mood: input.vibe?.label ?? "calm",\n    ok: true,\n  };\n}`}</pre>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <MarbleWorkbenchSection
                      actions={
                        <MarbleBadge tone="warning">3 pending</MarbleBadge>
                      }
                      badge={
                        <MarbleBadge className="font-mono">v9</MarbleBadge>
                      }
                      bodyStyle={{
                        height: 172,
                      }}
                      collapsed={isWorkbenchDraftCollapsed}
                      collapsible
                      description="Saving mints the next version while live runs stay on v8."
                      icon={<CodeBracketIcon className="h-4 w-4" />}
                      onToggleCollapsed={() =>
                        setIsWorkbenchDraftCollapsed((current) => !current)
                      }
                      title="Draft Stack"
                    >
                      <div className="h-full overflow-y-auto p-2">
                        {[
                          "Base v8",
                          "Edited input schema",
                          "Edited main.ts",
                          "Added package.json",
                        ].map((label, index) => (
                          <div
                            className="rounded-sm border border-taupe-300 bg-white px-3 py-2 shadow-sm"
                            key={label}
                            style={{
                              marginLeft: `${index * 10}px`,
                            }}
                          >
                            <div className="font-medium text-[12px] text-taupe-900">
                              {label}
                            </div>
                            <div className="mt-1 text-[11px] text-taupe-500">
                              Layered change cards keep the next version legible
                              before you commit it.
                            </div>
                          </div>
                        ))}
                        <MarbleWorkbenchResizeHandle title="Resize preview" />
                      </div>
                    </MarbleWorkbenchSection>

                    <MarbleWorkbenchSection
                      badge={<MarbleBadge tone="info">Saved v8</MarbleBadge>}
                      bodyStyle={{
                        height: 140,
                      }}
                      description="Testing stays pinned to the latest saved version until the draft stack is committed."
                      icon={<PlayIcon className="h-4 w-4" />}
                      title="Test Inputs"
                    >
                      <div className="space-y-2 p-2">
                        <MarbleInput
                          size="sm"
                          type="text"
                          value="cheerful"
                          wrapperClassName="w-full"
                        />
                        <MarbleButton
                          className="w-full"
                          size="sm"
                          variant="orange"
                        >
                          Run saved version
                        </MarbleButton>
                      </div>
                    </MarbleWorkbenchSection>
                  </div>
                </div>
              </div>
            </DemoPanel>
          </div>
        </Section>

        <Section
          description="Popover coverage now includes default and custom triggers, sectioned menus, workspace marks, compact workspace switchers, and disabled items."
          id="menus"
          title="Menus"
        >
          <div className="space-y-4">
            <DemoPanel
              description="Default dot trigger plus a custom button trigger with header content."
              title="Context popovers"
            >
              <div className="space-y-4">
                <div className="rounded-xs border border-taupe-200 bg-white p-4">
                  <div className="mb-3 font-medium text-[11px] text-taupe-500 uppercase tracking-[0.24em]">
                    Default trigger
                  </div>
                  <MarbleContextPopover
                    ariaLabel="Open utility menu"
                    sections={utilitySections}
                  />
                </div>

                <div className="rounded-xs border border-taupe-200 bg-white p-4">
                  <div className="mb-3 font-medium text-[11px] text-taupe-500 uppercase tracking-[0.24em]">
                    Custom trigger
                  </div>
                  <MarbleContextPopover
                    align="start"
                    ariaLabel="Open project menu"
                    asChild
                    header={
                      <div className="rounded-xs border border-orange-200 bg-orange-50/80 px-3 py-2">
                        <div className="font-medium text-sm text-taupe-950">
                          Project actions
                        </div>
                        <div className="text-xs text-taupe-600">
                          Header content keeps context attached to the menu.
                        </div>
                      </div>
                    }
                    sections={utilitySections}
                  >
                    <MarbleButton size="sm">Quick actions</MarbleButton>
                  </MarbleContextPopover>
                </div>
              </div>
            </DemoPanel>

            <DemoPanel
              description="Workspace mark, full trigger, compact trigger, and custom status treatment."
              title="Workspace popovers"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xs border border-taupe-200 bg-white p-4">
                  <MarbleWorkspaceMark />
                  <MarbleWorkspaceMark className="size-10" />
                </div>

                <MarbleWorkspacePopover
                  className="w-full"
                  description="Default workspace"
                  name="Marble"
                  sections={workspaceSections}
                />

                <div className="flex items-center justify-between rounded-xs border border-taupe-200 bg-white p-3">
                  <div className="space-y-1">
                    <div className="font-medium text-sm text-taupe-950">
                      Compact trigger
                    </div>
                    <div className="text-sm text-taupe-600">
                      Useful in header chrome where space is tighter.
                    </div>
                  </div>

                  <MarbleWorkspacePopover
                    compact
                    name="Marble"
                    sections={workspaceSections}
                    status={
                      <MarbleBadge
                        caps
                        tone="success"
                      >
                        live
                      </MarbleBadge>
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xs border border-taupe-200 bg-white p-3">
                  <div className="space-y-1">
                    <div className="font-medium text-sm text-taupe-950">
                      Slim trigger
                    </div>
                    <div className="text-sm text-taupe-600">
                      Narrow rail affordance with a dot-sized visual target.
                    </div>
                  </div>

                  <MarbleActivityRadarTrigger
                    aria-label="Expand agent sidebar"
                    batches={activityRadarBatches}
                    slim
                    unreadCount={1}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xs border border-taupe-200 bg-white p-3">
                  <div className="space-y-1">
                    <div className="font-medium text-sm text-taupe-950">
                      Agent changesets
                    </div>
                    <div className="text-sm text-taupe-600">
                      Compact agentic burst inbox for shell chrome.
                    </div>
                  </div>

                  <MarbleActivityRadar
                    batches={activityRadarBatches}
                    compact
                    onMarkAllRead={() =>
                      handleMenuSelect("Agent changesets: Mark all reviewed")
                    }
                    onOpenFeed={() =>
                      handleMenuSelect("Agent changesets: Open events")
                    }
                    unreadCount={1}
                  />
                </div>

                <div className="rounded-xs border border-taupe-200 bg-white p-3">
                  <div className="mb-3 space-y-1">
                    <div className="font-medium text-sm text-taupe-950">
                      Sidebar panel
                    </div>
                    <div className="text-sm text-taupe-600">
                      Inline review rail for persistent shell-side change
                      monitoring.
                    </div>
                  </div>

                  <div className="h-[28rem]">
                    <MarbleActivityRadarPanel
                      batches={activityRadarBatches}
                      className="h-full"
                      onMarkAllRead={() =>
                        handleMenuSelect("Agent changesets: Mark all reviewed")
                      }
                      unreadCount={1}
                    />
                  </div>
                </div>

                <div className="rounded-xs border border-taupe-200 bg-white p-3">
                  <div className="mb-3 space-y-1">
                    <div className="font-medium text-sm text-taupe-950">
                      Review navigator
                    </div>
                    <div className="text-sm text-taupe-600">
                      Compact review tray for stepping through grouped changes.
                    </div>
                  </div>

                  <MarbleReviewNavigator
                    currentIndex={reviewNavigatorIndex}
                    detailItems={[
                      {
                        label: "12 waves",
                        targetKeys: [
                          "table:demo-review",
                        ],
                      },
                      {
                        diffs: [
                          {
                            count: 24,
                            targetKeys: [
                              "cell:row-a:col-subject",
                              "cell:row-b:col-subject",
                            ],
                            tone: "update",
                          },
                        ],
                        label: "24 cells",
                        targetKeys: [
                          "cell:row-a:col-subject",
                          "cell:row-b:col-subject",
                          "cell:row-c:col-subject",
                        ],
                      },
                      {
                        diffs: [
                          {
                            count: 3,
                            targetKeys: [
                              "column:col-chaos",
                            ],
                            tone: "update",
                          },
                          {
                            count: 1,
                            targetKeys: [
                              "column:col-chaos",
                            ],
                            tone: "delete",
                          },
                        ],
                        label: "4 column dependencies",
                        targetKeys: [
                          "column:col-chaos",
                          "column:col-vibe",
                        ],
                      },
                    ]}
                    onClose={() => handleMenuSelect("Review navigator: Close")}
                    onNext={() =>
                      setReviewNavigatorIndex((current) => (current + 1) % 6)
                    }
                    onPreviewTargetsEnd={() =>
                      setLastInteraction("Review navigator: Preview cleared")
                    }
                    onPreviewTargetsStart={(targetKeys) =>
                      setLastInteraction(
                        `Review navigator: Preview ${targetKeys.length} target${targetKeys.length === 1 ? "" : "s"}`,
                      )
                    }
                    onPrevious={() =>
                      setReviewNavigatorIndex(
                        (current) => (current - 1 + 6) % 6,
                      )
                    }
                    onSelectIndex={setReviewNavigatorIndex}
                    summary="Snack Vibe Matrix"
                    totalCount={6}
                  />
                </div>

                <div className="rounded-xs border border-taupe-200 bg-white p-3">
                  <div className="mb-3 space-y-1">
                    <div className="font-medium text-sm text-taupe-950">
                      Profile attribution
                    </div>
                    <div className="text-sm text-taupe-600">
                      Tight ownership marks for one agent or a small mixed
                      group.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <MarbleProfileAttribution
                      profiles={[
                        {
                          externalName: "Claude Code",
                          icon: "🛠️",
                          id: "profile-demo-single",
                          name: "Schema Agent",
                          type: "Agent",
                        },
                      ]}
                    />
                    <MarbleProfileAttribution
                      profiles={[
                        {
                          externalName: "Codex",
                          icon: "🤖",
                          id: "profile-demo-multi-a",
                          name: "Build Agent",
                          type: "Agent",
                        },
                        {
                          externalName: "Cursor",
                          icon: "🔍",
                          id: "profile-demo-multi-b",
                          name: "Review Agent",
                          type: "Agent",
                        },
                        {
                          externalName: "Human",
                          id: "profile-demo-multi-c",
                          name: "Rory",
                          type: "Human",
                        },
                      ]}
                    />
                  </div>
                </div>

                <div className="rounded-xs border border-taupe-200 bg-white px-3 py-2">
                  <div className="font-medium text-[11px] text-taupe-500 uppercase tracking-[0.24em]">
                    Last menu action
                  </div>
                  <div className="mt-1 font-medium text-sm text-taupe-900">
                    {lastInteraction}
                  </div>
                </div>
              </div>
            </DemoPanel>
          </div>
        </Section>

        <Section
          description="The command surface now covers inline and dialog usage, disabled items, empty states, and selection feedback."
          id="commands"
          title="Commands"
        >
          <div className="space-y-4">
            <DemoPanel
              description="Inline command menu with grouped items and keyword search."
              title="Command menu"
            >
              <div className="h-[25rem] overflow-hidden rounded-xs border border-taupe-200 bg-white">
                <MarbleCommandMenu
                  className="h-full rounded-none border-0 shadow-none"
                  label="UI catalog command menu demo"
                  loop
                >
                  {renderCommandMenu()}
                </MarbleCommandMenu>
              </div>
            </DemoPanel>

            <DemoPanel
              description="Dialog-backed command surface using the same items."
              title="Command dialog"
            >
              <div className="space-y-4">
                <MarbleBadge
                  caps
                  tone="info"
                >
                  cmdk
                </MarbleBadge>
                <p className="text-sm text-taupe-600">
                  Search for `people`, `docs`, or `logout` to hit the keyword
                  paths and empty-state behavior.
                </p>
                <MarbleButton
                  onClick={() => setIsCommandDialogOpen(true)}
                  size="sm"
                  variant="dark"
                >
                  Open dialog example
                </MarbleButton>
                <div className="rounded-xs border border-taupe-200 bg-white px-3 py-2">
                  <div className="font-medium text-[11px] text-taupe-500 uppercase tracking-[0.24em]">
                    Last command selection
                  </div>
                  <div className="mt-1 font-medium text-sm text-taupe-900">
                    {selectedCommandExample}
                  </div>
                </div>
              </div>
            </DemoPanel>
          </div>
        </Section>

        <Section
          description="Overlay coverage includes all modal sizes plus every sheet side, with both sheets and modals rendered as real top-layer portals instead of fighting local stacking contexts."
          id="overlays"
          title="Overlays"
        >
          <div className="space-y-4">
            <DemoPanel
              description="Every side is selectable from the harness, and the sheet now portals to the page root instead of pretending its host card is the viewport."
              title="Sheet"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {sheetSides.map((side) => (
                    <MarbleButton
                      key={side}
                      onClick={() => {
                        setSheetSide(side);
                        setIsSheetOpen(true);
                      }}
                      size="sm"
                      variant={sheetSide === side ? "orange" : "light"}
                    >
                      {side}
                    </MarbleButton>
                  ))}
                </div>

                <div className="h-88 overflow-hidden rounded-xs border border-taupe-200 bg-white">
                  <div className="flex h-full flex-col gap-3 bg-linear-to-br from-white via-taupe-50 to-taupe-100 p-4">
                    <MarbleBadge
                      caps
                      tone="info"
                    >
                      Underlay
                    </MarbleBadge>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg text-taupe-900">
                        Underlying page
                      </h3>
                      <p className="max-w-sm text-sm text-taupe-600">
                        Opening a sheet now uses the document-level overlay
                        layer, so this card is just the page beneath it.
                      </p>
                    </div>
                  </div>

                  <MarbleSheet
                    onOpenChange={setIsSheetOpen}
                    open={isSheetOpen}
                  >
                    <MarbleSheetContent
                      showCloseButton={false}
                      side={sheetSide}
                    >
                      <MarbleSheetHeader className="relative pr-14">
                        <MarbleSheetTitle>Shared sheet shell</MarbleSheetTitle>
                        <MarbleSheetDescription>
                          Side-specific motion now works for every exposed
                          variant.
                        </MarbleSheetDescription>
                        <MarbleSheetClose className="absolute top-3 right-3" />
                      </MarbleSheetHeader>

                      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                        <MarbleAlert
                          size="sm"
                          tone="neutral"
                        >
                          The sheet is no longer clipped by the demo card.
                        </MarbleAlert>
                        <p className="text-sm text-taupe-600">
                          Current side:{" "}
                          <span className="font-medium">{sheetSide}</span>
                        </p>
                      </div>

                      <MarbleSheetFooter>
                        <MarbleSheetClose className="h-auto w-auto rounded-xs border border-taupe-200 px-3 py-1.5 text-sm text-taupe-700">
                          Dismiss
                        </MarbleSheetClose>
                        <MarbleButton variant="orange">Apply</MarbleButton>
                      </MarbleSheetFooter>
                    </MarbleSheetContent>
                  </MarbleSheet>
                </div>
              </div>
            </DemoPanel>

            <DemoPanel
              description="Modal sizes use a shared trigger harness, and the dialog description is now surfaced in the catalog."
              title="Modal"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {modalSizes.map((size) => (
                    <MarbleButton
                      key={size}
                      onClick={() => {
                        setModalSize(size);
                        setIsModalOpen(true);
                      }}
                      size="sm"
                      variant={modalSize === size ? "dark" : "light"}
                    >
                      Open {size}
                    </MarbleButton>
                  ))}
                </div>

                <div className="rounded-xs border border-taupe-200 bg-white px-3 py-3">
                  <div className="font-medium text-[11px] text-taupe-500 uppercase tracking-[0.24em]">
                    Current modal size
                  </div>
                  <div className="mt-1 font-medium text-sm text-taupe-900">
                    {modalSize.toUpperCase()}
                  </div>
                </div>

                <MarbleAlert tone="neutral">
                  Modals now render through a portal so they clear page-level
                  stacking contexts like the internal catalog cards.
                </MarbleAlert>
              </div>
            </DemoPanel>
          </div>
        </Section>
      </div>

      <MarbleCommandDialog
        label="UI catalog command dialog demo"
        loop
        onOpenChange={setIsCommandDialogOpen}
        open={isCommandDialogOpen}
      >
        {renderCommandMenu(true)}
      </MarbleCommandDialog>

      {isModalOpen ? (
        <MarbleModal
          ariaLabel="UI catalog modal demo"
          onClose={() => setIsModalOpen(false)}
          size={modalSize}
        >
          <MarbleModalHeader>
            <MarbleModalTitle>Shared modal shell</MarbleModalTitle>
            <MarbleModalDescription>
              Portal-backed overlay with a size-aware panel and shared dismissal
              behavior.
            </MarbleModalDescription>
          </MarbleModalHeader>
          <MarbleModalContent className="space-y-3">
            <p className="text-sm text-taupe-600">
              This demo intentionally sits outside the section cards so the
              overlay behavior matches real usage.
            </p>
            <MarbleAlert
              size="sm"
              tone="warning"
            >
              Escape and backdrop dismissal are handled in the shared component.
            </MarbleAlert>
          </MarbleModalContent>
          <MarbleModalFooter>
            <MarbleButton
              onClick={() => setIsModalOpen(false)}
              size="sm"
            >
              Close
            </MarbleButton>
            <MarbleButton
              size="sm"
              variant="orange"
            >
              Confirm
            </MarbleButton>
          </MarbleModalFooter>
        </MarbleModal>
      ) : null}
    </main>
  );
}
