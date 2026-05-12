"use client";

import {
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
import {
  CodeIcon,
  FolderOpenIcon,
  QuestionIcon,
  SquaresFourIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";

export function WorkspaceActions({
  selectedAction,
  onSelect,
}: Readonly<{
  selectedAction: string;
  onSelect: (value: string) => void;
}>) {
  return (
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
                  onSelect={() => onSelect("Create project")}
                  value="Create project"
                >
                  <FolderOpenIcon
                    className="text-orange-600"
                    size={16}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Create project</div>
                    <div className="text-xs text-taupe-500">
                      Start a new workspace shell.
                    </div>
                  </div>
                  <span className="font-mono text-eyebrow-xs text-taupe-400">
                    New
                  </span>
                </MarbleCommandItem>
                <MarbleCommandItem
                  keywords={[
                    "tables",
                    "rows",
                    "columns",
                  ]}
                  onSelect={() => onSelect("Open tables")}
                  value="Open tables"
                >
                  <SquaresFourIcon
                    className="text-sky-600"
                    size={16}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Open tables</div>
                    <div className="text-xs text-taupe-500">
                      Inspect table rows, columns, and runs.
                    </div>
                  </div>
                  <span className="font-mono text-eyebrow-xs text-taupe-400">
                    Data
                  </span>
                </MarbleCommandItem>
                <MarbleCommandItem
                  keywords={[
                    "program",
                    "code",
                    "editor",
                  ]}
                  onSelect={() => onSelect("Run active program")}
                  value="Run active program"
                >
                  <CodeIcon
                    className="text-zinc-700"
                    size={16}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Run active program</div>
                    <div className="text-xs text-taupe-500">
                      Execute the current program against its inputs.
                    </div>
                  </div>
                  <span className="font-mono text-eyebrow-xs text-taupe-400">
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
                  onSelect={() => onSelect("Browse profiles")}
                  value="Browse profiles"
                >
                  <UsersThreeIcon
                    className="text-emerald-600"
                    size={16}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Browse profiles</div>
                    <div className="text-xs text-taupe-500">
                      Inspect saved agent profiles and prompts.
                    </div>
                  </div>
                  <span className="font-mono text-eyebrow-xs text-taupe-400">
                    Jump
                  </span>
                </MarbleCommandItem>
                <MarbleCommandItem
                  keywords={[
                    "help",
                    "docs",
                    "support",
                  ]}
                  onSelect={() => onSelect("Open help topics")}
                  value="Open help topics"
                >
                  <QuestionIcon
                    className="text-violet-600"
                    size={16}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Open help topics</div>
                    <div className="text-xs text-taupe-500">
                      Jump into the temporary support index.
                    </div>
                  </div>
                  <span className="font-mono text-eyebrow-xs text-taupe-400">
                    Help
                  </span>
                </MarbleCommandItem>
              </MarbleCommandGroup>
            </MarbleCommandList>
          </MarbleCommandMenu>
        </div>

        <div className="grid gap-3 px-5 py-4 md:grid-cols-2">
          <MarbleStat
            framed
            label="Selected action"
            tone="neutral"
            value={selectedAction}
          />
          <MarbleStat
            framed
            label="Try searching"
            tone="neutral"
            value="project, rows, program, or people"
          />
        </div>
      </MarbleCardContent>
    </MarbleCard>
  );
}
