"use client";

import {
  ArrowRightStartOnRectangleIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  FolderOpenIcon,
  QuestionMarkCircleIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
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
  MarbleEditableText,
  MarbleEmptyState,
  MarbleFieldLabel,
  MarbleInput,
  MarbleListRow,
  MarbleModal,
  MarbleModalContent,
  MarbleModalFooter,
  MarbleModalHeader,
  MarbleModalTitle,
  MarblePane,
  MarblePaneEditableCrumb,
  MarbleSearchSelect,
  MarbleSelect,
  MarbleTextarea,
  MarbleWorkspacePopover,
} from "@marble/ui";
import { useState } from "react";

function Section({
  children,
  title,
}: Readonly<{
  children: React.ReactNode;
  title: string;
}>) {
  return (
    <MarbleCard>
      <MarbleCardHeader className="pb-4">
        <MarbleCardTitle>{title}</MarbleCardTitle>
      </MarbleCardHeader>
      <MarbleCardContent>{children}</MarbleCardContent>
    </MarbleCard>
  );
}

export default function UiPage() {
  const [editableValue, setEditableValue] = useState("Untitled Project");
  const [editableCrumbValue, setEditableCrumbValue] = useState(
    "Audience Enrichment",
  );
  const [isEditingCrumb, setIsEditingCrumb] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isCommandDialogOpen, setIsCommandDialogOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCommandExample, setSelectedCommandExample] =
    useState("Open projects");
  const handleDemoSelect = (label: string) => {
    console.info(`${label} selected`);
  };

  return (
    <main className="min-h-screen bg-taupe-100 px-6 py-8 text-taupe-800">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <p className="font-medium text-[11px] text-orange-600 uppercase tracking-[0.24em]">
            Marble UI
          </p>
          <h1 className="font-semibold text-3xl tracking-tight">
            Kitchen sink
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            A small preview surface for the shared Marble-specific controls.
          </p>
        </header>

        <Section title="Buttons">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <MarbleButton variant="orange">Run All</MarbleButton>
              <MarbleButton>Add</MarbleButton>
              <MarbleButton variant="dark">Inspect</MarbleButton>
              <MarbleButton variant="red">Delete</MarbleButton>
              <MarbleButton
                disabled
                variant="orange"
              >
                Running...
              </MarbleButton>
            </div>
            <p className="max-w-2xl text-sm text-zinc-500">
              Hover each button to inspect the new cursor dot: a fast 0.2s fade
              with a slight positional lag and a feathered, slightly noisy blob.
              Light buttons get a muted shadow spot, while saturated buttons
              lift with a softer desaturated highlight. Press and hold to
              inspect the inverted border bevel.
            </p>
          </div>
        </Section>

        <Section title="Badges">
          <div className="grid grid-rows-2 gap-2">
            {(
              [
                "neutral",
                "warning",
                "info",
                "error",
                "solid",
                "success",
              ] as const
            ).flatMap((keyword) => [
              <MarbleBadge
                caps
                className="row-1"
                key={`caps--${keyword}`}
                tone={keyword}
              >
                {keyword} caps
              </MarbleBadge>,
              <MarbleBadge
                className="row-2"
                key={`nocaps--${keyword}`}
                tone={keyword}
              >
                {keyword}
              </MarbleBadge>,
            ])}
          </div>
        </Section>

        <Section title="Alerts">
          <div className="space-y-3">
            <MarbleAlert tone="neutral">
              Neutral feedback for dense workspace surfaces.
            </MarbleAlert>
            <MarbleAlert tone="success">
              Account created. Confirm the email address before signing in.
            </MarbleAlert>
            <MarbleAlert tone="warning">
              This program reads from manual input fields.
            </MarbleAlert>
            <MarbleAlert tone="error">
              Deleting this project failed.
            </MarbleAlert>
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 md:grid-cols-3">
            <MarbleCard>
              <MarbleCardHeader>
                <MarbleCardTitle>Default</MarbleCardTitle>
                <MarbleCardDescription>
                  Neutral chrome for standard workspace panels.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                  Rows: 128
                </div>
              </MarbleCardContent>
              <MarbleCardFooter>
                <MarbleButton size="sm">Inspect</MarbleButton>
              </MarbleCardFooter>
            </MarbleCard>

            <MarbleCard tone="subtle">
              <MarbleCardHeader>
                <MarbleCardTitle>Subtle</MarbleCardTitle>
                <MarbleCardDescription>
                  Low-contrast framing for dense UI surfaces.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent className="space-y-2">
                <MarbleFieldLabel>Table Name</MarbleFieldLabel>
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
                  Accent treatment for active or important surfaces.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent className="space-y-2">
                <div className="rounded-xl border border-orange-200 bg-white/80 p-3 text-sm text-zinc-700">
                  14 runnable columns ready.
                </div>
              </MarbleCardContent>
              <MarbleCardFooter>
                <MarbleButton
                  size="sm"
                  variant="orange"
                >
                  Run All
                </MarbleButton>
              </MarbleCardFooter>
            </MarbleCard>
          </div>
        </Section>

        <Section title="Empty States">
          <div className="grid gap-4 md:grid-cols-2">
            <MarbleCard>
              <MarbleCardContent>
                <MarbleEmptyState
                  description="Create an untitled project, then rename it from the project page."
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
                  description="Create one above to watch the list update locally and across tabs."
                  title="No profiles yet"
                />
              </MarbleCardContent>
            </MarbleCard>
          </div>
        </Section>

        <Section title="Toolbar Example">
          <div className="flex flex-wrap items-center gap-0.5 rounded-xs border border-neutral-200 bg-neutral-100 p-2">
            <MarbleButton variant="orange">Run All</MarbleButton>
            <MarbleButton>Add</MarbleButton>
            <MarbleInput
              defaultValue={12}
              max="100"
              min="1"
              size="sm"
              type="number"
              wrapperClassName="w-20"
            />
            <span className="text-sm text-zinc-200 p-0.5 ml-1 bg-neutral-500/90 rounded-sm px-2">
              Rows
            </span>
          </div>
        </Section>

        <Section title="Popovers">
          <div className="grid gap-4 md:grid-cols-[auto_minmax(0,20rem)]">
            <div className="rounded-xs border border-taupe-200 bg-white p-3">
              <div className="mb-3 text-sm text-zinc-500">Utility menu</div>
              <MarbleContextPopover
                ariaLabel="Open utility menu"
                items={[
                  {
                    icon: <Cog6ToothIcon className="h-4 w-4" />,
                    id: "popover-settings",
                    label: "Settings",
                    onSelect: () => handleDemoSelect("Settings"),
                  },
                  {
                    icon: <QuestionMarkCircleIcon className="h-4 w-4" />,
                    id: "popover-help",
                    label: "Help",
                    onSelect: () => handleDemoSelect("Help"),
                  },
                  {
                    icon: (
                      <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                    ),
                    id: "popover-sign-out",
                    label: "Sign out",
                    onSelect: () => handleDemoSelect("Sign out"),
                    tone: "danger",
                  },
                ]}
              />
            </div>

            <div className="rounded-xs border border-taupe-200 bg-taupe-50 p-3">
              <div className="mb-3 text-sm text-zinc-500">
                Workspace switcher
              </div>
              <MarbleWorkspacePopover
                className="w-full"
                description="Default workspace"
                name="Marble"
                sections={[
                  {
                    id: "popover-workspace-primary",
                    items: [
                      {
                        icon: <UserGroupIcon className="h-4 w-4" />,
                        id: "popover-team",
                        label: "Team directory",
                        onSelect: () => handleDemoSelect("Team directory"),
                      },
                      {
                        icon: <Squares2X2Icon className="h-4 w-4" />,
                        id: "popover-apps",
                        label: "Apps and integrations",
                        onSelect: () =>
                          handleDemoSelect("Apps and integrations"),
                      },
                    ],
                  },
                  {
                    id: "popover-workspace-secondary",
                    items: [
                      {
                        icon: <Cog6ToothIcon className="h-4 w-4" />,
                        id: "popover-workspace-settings",
                        label: "Workspace settings",
                        onSelect: () => handleDemoSelect("Workspace settings"),
                      },
                      {
                        icon: <QuestionMarkCircleIcon className="h-4 w-4" />,
                        id: "popover-workspace-help",
                        label: "Help",
                        onSelect: () => handleDemoSelect("Help"),
                      },
                    ],
                  },
                  {
                    id: "popover-workspace-session",
                    items: [
                      {
                        icon: (
                          <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                        ),
                        id: "popover-workspace-sign-out",
                        label: "Sign out",
                        onSelect: () => handleDemoSelect("Sign out"),
                        tone: "danger",
                      },
                    ],
                  },
                ]}
              />
            </div>
          </div>
        </Section>

        <Section title="Command Menus">
          <div className="grid gap-4 md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
            <div className="h-[22rem] overflow-hidden rounded-xs border border-taupe-200 bg-white">
              <MarbleCommandMenu
                className="h-full rounded-none border-0 shadow-none"
                label="UI catalog command menu demo"
                loop
              >
                <MarbleCommandInput placeholder="Search projects, profiles, or support..." />
                <MarbleCommandList>
                  <MarbleCommandEmpty>No matching command.</MarbleCommandEmpty>

                  <MarbleCommandGroup heading="Workspace">
                    <MarbleCommandItem
                      keywords={[
                        "projects",
                        "folders",
                      ]}
                      onSelect={() =>
                        setSelectedCommandExample("Open projects")
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
                        setSelectedCommandExample("Browse profiles")
                      }
                      value="Browse profiles"
                    >
                      <UserGroupIcon className="h-4 w-4 text-emerald-600" />
                      <span className="flex-1">Browse profiles</span>
                    </MarbleCommandItem>
                    <MarbleCommandItem
                      keywords={[
                        "settings",
                        "preferences",
                      ]}
                      onSelect={() =>
                        setSelectedCommandExample("Open settings")
                      }
                      value="Open settings"
                    >
                      <Cog6ToothIcon className="h-4 w-4 text-zinc-500" />
                      <span className="flex-1">Open settings</span>
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
                        setSelectedCommandExample("Open help examples")
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
                      onSelect={() => setSelectedCommandExample("Sign out")}
                      value="Sign out"
                    >
                      <ArrowRightStartOnRectangleIcon className="h-4 w-4 text-rose-600" />
                      <span className="flex-1">Sign out</span>
                    </MarbleCommandItem>
                  </MarbleCommandGroup>
                </MarbleCommandList>
              </MarbleCommandMenu>
            </div>

            <div className="space-y-3 rounded-xs border border-taupe-200 bg-taupe-50 p-4">
              <MarbleBadge
                caps
                tone="info"
              >
                cmdk
              </MarbleBadge>
              <p className="text-sm text-zinc-600">
                Shared grouped search with keyboard navigation and empty-state
                handling, now available from `@marble/ui`.
              </p>
              <MarbleButton
                onClick={() => setIsCommandDialogOpen(true)}
                size="sm"
                variant="dark"
              >
                Open dialog example
              </MarbleButton>
              <div className="rounded-xs border border-taupe-200 bg-white px-3 py-2">
                <div className="font-medium text-[11px] text-taupe-500 uppercase tracking-[0.22em]">
                  Last selection
                </div>
                <div className="mt-1 font-medium text-sm text-taupe-900">
                  {selectedCommandExample}
                </div>
              </div>
              <p className="text-sm text-zinc-500">
                Try searching for `people`, `settings`, or `docs` to verify the
                keyword matching behavior.
              </p>
            </div>
          </div>

          {isCommandDialogOpen ? (
            <MarbleCommandDialog
              label="UI catalog command dialog demo"
              loop
              onOpenChange={setIsCommandDialogOpen}
              open={isCommandDialogOpen}
            >
              <MarbleCommandInput placeholder="Search the same example commands in a dialog..." />
              <MarbleCommandList>
                <MarbleCommandEmpty>No matching command.</MarbleCommandEmpty>
                <MarbleCommandGroup heading="Workspace">
                  <MarbleCommandItem
                    keywords={[
                      "projects",
                      "folders",
                    ]}
                    onSelect={() => {
                      setSelectedCommandExample("Open projects");
                      setIsCommandDialogOpen(false);
                    }}
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
                    onSelect={() => {
                      setSelectedCommandExample("Browse profiles");
                      setIsCommandDialogOpen(false);
                    }}
                    value="Browse profiles"
                  >
                    <UserGroupIcon className="h-4 w-4 text-emerald-600" />
                    <span className="flex-1">Browse profiles</span>
                  </MarbleCommandItem>
                </MarbleCommandGroup>
                <MarbleCommandSeparator />
                <MarbleCommandGroup heading="Support">
                  <MarbleCommandItem
                    keywords={[
                      "help",
                      "docs",
                    ]}
                    onSelect={() => {
                      setSelectedCommandExample("Open help examples");
                      setIsCommandDialogOpen(false);
                    }}
                    value="Open help examples"
                  >
                    <QuestionMarkCircleIcon className="h-4 w-4 text-violet-600" />
                    <span className="flex-1">Open help examples</span>
                  </MarbleCommandItem>
                </MarbleCommandGroup>
              </MarbleCommandList>
            </MarbleCommandDialog>
          ) : null}
        </Section>

        <Section title="List Rows">
          <MarbleCard>
            <MarbleCardContent className="p-0">
              <MarbleListRow
                description={
                  <>
                    <MarbleBadge
                      caps
                      className="py-0.5"
                      tone="warning"
                    >
                      Built-in
                    </MarbleBadge>
                    <span>3 versions</span>
                  </>
                }
                descriptionClassName="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500"
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
                description="TypeScript"
                icon={<CodeBracketIcon className="h-4 w-4 text-sky-600" />}
                size="sm"
                title="runner.ts"
              />
            </MarbleCardContent>
          </MarbleCard>
        </Section>

        <Section title="Pane">
          <div className="h-80 overflow-hidden rounded-md border border-taupe-200 bg-taupe-50 shadow-sm">
            <MarblePane
              actions={[
                {
                  children: "Create",
                  id: "create",
                  variant: "dark",
                },
              ]}
              crumbs={[
                {
                  href: "/projects",
                  id: "projects",
                  label: "Projects",
                },
                {
                  id: "current",
                  label: "Untitled Project",
                },
              ]}
            >
              <MarbleCard>
                <MarbleCardHeader>
                  <MarbleCardTitle>Shared layout chrome</MarbleCardTitle>
                  <MarbleCardDescription>
                    Breadcrumbs, actions, and scroll framing now live in the UI
                    package instead of `apps/web`.
                  </MarbleCardDescription>
                </MarbleCardHeader>
              </MarbleCard>
            </MarblePane>
          </div>
        </Section>

        <Section title="Editable Text">
          <div className="space-y-4">
            <div className="flex items-center gap-1">
              <span className="rounded-sm px-1.5 py-1 font-medium text-base text-neutral-800">
                Projects
              </span>
              <span
                aria-hidden="true"
                className="text-taupe-300"
              >
                &gt;
              </span>
              <MarblePaneEditableCrumb
                disabled={false}
                editing={isEditingCrumb}
                onCancel={() => {
                  setEditableCrumbValue("Audience Enrichment");
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
              disabled={false}
              editing={isEditingName}
              onCancel={() => {
                setEditableValue("Untitled Project");
                setIsEditingName(false);
              }}
              onChange={setEditableValue}
              onCommit={() => setIsEditingName(false)}
              onEdit={() => setIsEditingName(true)}
              value={editableValue}
            />
            <p className="text-sm text-zinc-500">
              Shared inline rename behavior for breadcrumb and pane title
              surfaces.
            </p>
          </div>
        </Section>

        <Section title="Modal">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <MarbleButton
                onClick={() => setIsModalOpen(true)}
                variant="dark"
              >
                Open modal
              </MarbleButton>
              <span className="text-sm text-zinc-500">
                Shared dialog shell for confirmations and inspectors.
              </span>
            </div>

            {isModalOpen ? (
              <MarbleModal
                ariaLabel="UI catalog modal demo"
                onClose={() => setIsModalOpen(false)}
                size="sm"
              >
                <MarbleModalHeader>
                  <MarbleModalTitle>Shared modal shell</MarbleModalTitle>
                </MarbleModalHeader>
                <MarbleModalContent className="space-y-3">
                  <p className="text-sm text-zinc-600">
                    This uses the same dialog primitive now backing the table
                    inspector and destructive confirmation flows.
                  </p>
                  <MarbleAlert
                    size="sm"
                    tone="warning"
                  >
                    Escape and backdrop dismissal are handled in the shared
                    component.
                  </MarbleAlert>
                </MarbleModalContent>
                <MarbleModalFooter>
                  <MarbleButton onClick={() => setIsModalOpen(false)}>
                    Close
                  </MarbleButton>
                </MarbleModalFooter>
              </MarbleModal>
            ) : null}
          </div>
        </Section>

        <Section title="Form Controls">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <MarbleFieldLabel>Name</MarbleFieldLabel>
              <MarbleInput
                defaultValue="Uppercased Company"
                placeholder="Column name"
                wrapperClassName="w-full"
              />
            </div>

            <div>
              <MarbleFieldLabel>Program</MarbleFieldLabel>
              <MarbleSelect
                defaultValue="uppercase"
                wrapperClassName="w-full"
              >
                <option value="uppercase">Uppercase String</option>
                <option value="http-request">HTTP Request</option>
                <option value="formula">Formula</option>
              </MarbleSelect>
            </div>

            <div>
              <MarbleFieldLabel>Agent Provider</MarbleFieldLabel>
              <MarbleSearchSelect
                defaultValue="Codex"
                options={[
                  "Codex",
                  "Claude Code",
                  "OpenCode",
                  "Cursor",
                  "Windsurf",
                  "Gemini CLI",
                  "GitHub Copilot",
                ]}
                placeholder="Search or select a provider"
                wrapperClassName="w-full"
              />
            </div>

            <div className="md:col-span-2">
              <MarbleFieldLabel>Input Template</MarbleFieldLabel>
              <MarbleTextarea
                defaultValue={`{\n  "companyName.$": "$.columns.company.value",\n  "tone": "warm"\n}`}
                monospace
                rows={8}
                size="xs"
                wrapperClassName="w-full"
              />
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}
