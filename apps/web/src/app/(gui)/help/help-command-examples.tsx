"use client";

import {
  CodeBracketIcon,
  FolderOpenIcon,
  QuestionMarkCircleIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
  MarbleBadge,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleCommandEmpty,
  MarbleCommandGroup,
  MarbleCommandInput,
  MarbleCommandItem,
  MarbleCommandList,
  MarbleCommandMenu,
  MarbleCommandSeparator,
  MarbleStat,
} from "@marble/ui";
import { useState } from "react";

function SelectionPreview({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <MarbleStat
      framed
      label={label}
      tone="neutral"
      value={value}
    />
  );
}

export function HelpCommandExamples() {
  const [selectedAction, setSelectedAction] = useState("Create project");
  const [selectedTopic, setSelectedTopic] = useState("Profiles overview");

  return (
    <div className="flex flex-col gap-6">
      <MarbleCard tone="orange">
        <MarbleCardHeader className="gap-3 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <MarbleBadge
              caps
              tone="solid"
            >
              cmdk
            </MarbleBadge>
            <MarbleBadge
              caps
              tone="warning"
            >
              Temporary help surface
            </MarbleBadge>
          </div>
          <MarbleCardTitle>
            Help is an interactive prototype for now
          </MarbleCardTitle>
          <MarbleCardDescription>
            This replaces the placeholder help page with live `cmdk` examples.
            Filtering, grouping, separators, and item selection are all wired up
            here so the eventual help surface can grow from a shared primitive
            instead of bespoke route code.
          </MarbleCardDescription>
        </MarbleCardHeader>
      </MarbleCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <MarbleCard className="min-h-0 overflow-hidden">
          <MarbleCardHeader>
            <MarbleCardTitle>Workspace actions</MarbleCardTitle>
            <MarbleCardDescription>
              Search a few representative actions and select one to update the
              preview below.
            </MarbleCardDescription>
          </MarbleCardHeader>
          <MarbleCardContent className="px-0 pb-0">
            <div className="h-[24rem]">
              <MarbleCommandMenu
                className="h-full"
                embedded
                label="Workspace action examples"
                loop
              >
                <MarbleCommandInput placeholder="Search actions, screens, or records..." />
                <MarbleCommandList>
                  <MarbleCommandEmpty>
                    No matching workspace action.
                  </MarbleCommandEmpty>

                  <MarbleCommandGroup heading="Create and open">
                    <MarbleCommandItem
                      keywords={[
                        "new",
                        "project",
                        "workspace",
                      ]}
                      onSelect={() => setSelectedAction("Create project")}
                      value="Create project"
                    >
                      <FolderOpenIcon className="h-4 w-4 text-orange-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">Create project</div>
                        <div className="text-xs text-taupe-500">
                          Start a new workspace shell.
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-taupe-400 uppercase tracking-[0.18em]">
                        New
                      </span>
                    </MarbleCommandItem>
                    <MarbleCommandItem
                      keywords={[
                        "tables",
                        "rows",
                        "columns",
                      ]}
                      onSelect={() => setSelectedAction("Open tables")}
                      value="Open tables"
                    >
                      <Squares2X2Icon className="h-4 w-4 text-sky-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">Open tables</div>
                        <div className="text-xs text-taupe-500">
                          Inspect table rows, columns, and runs.
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-taupe-400 uppercase tracking-[0.18em]">
                        Data
                      </span>
                    </MarbleCommandItem>
                    <MarbleCommandItem
                      keywords={[
                        "program",
                        "code",
                        "editor",
                      ]}
                      onSelect={() => setSelectedAction("Run active program")}
                      value="Run active program"
                    >
                      <CodeBracketIcon className="h-4 w-4 text-zinc-700" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">Run active program</div>
                        <div className="text-xs text-taupe-500">
                          Execute the current program against its inputs.
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-taupe-400 uppercase tracking-[0.18em]">
                        Run
                      </span>
                    </MarbleCommandItem>
                  </MarbleCommandGroup>

                  <MarbleCommandSeparator />

                  <MarbleCommandGroup heading="Jump to">
                    <MarbleCommandItem
                      keywords={[
                        "profiles",
                        "people",
                        "personas",
                      ]}
                      onSelect={() => setSelectedAction("Browse profiles")}
                      value="Browse profiles"
                    >
                      <UserGroupIcon className="h-4 w-4 text-emerald-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">Browse profiles</div>
                        <div className="text-xs text-taupe-500">
                          Inspect saved agent profiles and prompts.
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-taupe-400 uppercase tracking-[0.18em]">
                        Jump
                      </span>
                    </MarbleCommandItem>
                    <MarbleCommandItem
                      keywords={[
                        "help",
                        "docs",
                        "support",
                      ]}
                      onSelect={() => setSelectedAction("Open help topics")}
                      value="Open help topics"
                    >
                      <QuestionMarkCircleIcon className="h-4 w-4 text-violet-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">Open help topics</div>
                        <div className="text-xs text-taupe-500">
                          Jump into the temporary support index.
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-taupe-400 uppercase tracking-[0.18em]">
                        Help
                      </span>
                    </MarbleCommandItem>
                  </MarbleCommandGroup>
                </MarbleCommandList>
              </MarbleCommandMenu>
            </div>

            <div className="grid gap-3 px-5 py-4 md:grid-cols-2">
              <SelectionPreview
                label="Selected action"
                value={selectedAction}
              />
              <SelectionPreview
                label="Try searching"
                value="project, rows, program, or people"
              />
            </div>
          </MarbleCardContent>
        </MarbleCard>

        <MarbleCard className="min-h-0 overflow-hidden">
          <MarbleCardHeader>
            <MarbleCardTitle>Help topics</MarbleCardTitle>
            <MarbleCardDescription>
              A second example focused on keyword matching for concepts and
              guidance.
            </MarbleCardDescription>
          </MarbleCardHeader>
          <MarbleCardContent className="px-0 pb-0">
            <div className="h-[24rem]">
              <MarbleCommandMenu
                className="h-full"
                embedded
                label="Help topic examples"
                loop
              >
                <MarbleCommandInput placeholder="Search profiles, automations, tables, or programs..." />
                <MarbleCommandList>
                  <MarbleCommandEmpty>
                    No matching help topic.
                  </MarbleCommandEmpty>

                  <MarbleCommandGroup heading="Concepts">
                    <MarbleCommandItem
                      keywords={[
                        "people",
                        "personas",
                        "agents",
                      ]}
                      onSelect={() => setSelectedTopic("Profiles overview")}
                      value="Profiles overview"
                    >
                      <UserGroupIcon className="h-4 w-4 text-emerald-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">Profiles overview</div>
                        <div className="text-xs text-taupe-500">
                          How profiles shape prompts and agent behavior.
                        </div>
                      </div>
                    </MarbleCommandItem>
                    <MarbleCommandItem
                      keywords={[
                        "scheduled",
                        "agents",
                        "runs",
                      ]}
                      onSelect={() => setSelectedTopic("Automations primer")}
                      value="Automations primer"
                    >
                      <QuestionMarkCircleIcon className="h-4 w-4 text-orange-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">Automations primer</div>
                        <div className="text-xs text-taupe-500">
                          What recurring runs do and where they live.
                        </div>
                      </div>
                    </MarbleCommandItem>
                  </MarbleCommandGroup>

                  <MarbleCommandSeparator />

                  <MarbleCommandGroup heading="Data surfaces">
                    <MarbleCommandItem
                      keywords={[
                        "columns",
                        "rows",
                        "grid",
                      ]}
                      onSelect={() => setSelectedTopic("Tables and schema")}
                      value="Tables and schema"
                    >
                      <Squares2X2Icon className="h-4 w-4 text-sky-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">Tables and schema</div>
                        <div className="text-xs text-taupe-500">
                          Rows, columns, references, and runnable cells.
                        </div>
                      </div>
                    </MarbleCommandItem>
                    <MarbleCommandItem
                      keywords={[
                        "code",
                        "input",
                        "runner",
                      ]}
                      onSelect={() => setSelectedTopic("Programs and inputs")}
                      value="Programs and inputs"
                    >
                      <CodeBracketIcon className="h-4 w-4 text-zinc-700" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">Programs and inputs</div>
                        <div className="text-xs text-taupe-500">
                          How programs read input, execute, and write back.
                        </div>
                      </div>
                    </MarbleCommandItem>
                    <MarbleCommandItem
                      keywords={[
                        "sources",
                        "sync",
                        "connectors",
                      ]}
                      onSelect={() => setSelectedTopic("Sources and syncs")}
                      value="Sources and syncs"
                    >
                      <FolderOpenIcon className="h-4 w-4 text-indigo-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">Sources and syncs</div>
                        <div className="text-xs text-taupe-500">
                          Connecting external systems into the workspace.
                        </div>
                      </div>
                    </MarbleCommandItem>
                  </MarbleCommandGroup>
                </MarbleCommandList>
              </MarbleCommandMenu>
            </div>

            <div className="grid gap-3 px-5 py-4 md:grid-cols-2">
              <SelectionPreview
                label="Selected topic"
                value={selectedTopic}
              />
              <SelectionPreview
                label="Try searching"
                value="people, scheduled, columns, input, or sync"
              />
            </div>
          </MarbleCardContent>
        </MarbleCard>
      </div>
    </div>
  );
}
