"use client";

import { CodeBracketIcon, FolderOpenIcon } from "@heroicons/react/24/outline";
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
  MarbleSelect,
  MarbleTextarea,
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap items-center gap-2">
            <MarbleBadge
              caps
              tone="neutral"
            >
              Agent
            </MarbleBadge>
            <MarbleBadge
              caps
              tone="warning"
            >
              claude-code
            </MarbleBadge>
            <MarbleBadge
              caps
              tone="info"
            >
              creating
            </MarbleBadge>
            <MarbleBadge tone="solid">12 total</MarbleBadge>
            <MarbleBadge tone="success">Realtime live</MarbleBadge>
            <MarbleBadge tone="error">Realtime error</MarbleBadge>
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
            <MarbleEditableText
              className="text-left text-3xl tracking-tight text-zinc-950 transition-colors hover:text-orange-600"
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
              Shared inline rename behavior for project and table surfaces.
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
