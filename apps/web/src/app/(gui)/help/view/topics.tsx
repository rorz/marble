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

export function Topics({
  selectedTopic,
  onSelect,
}: Readonly<{
  selectedTopic: string;
  onSelect: (value: string) => void;
}>) {
  return (
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
              <MarbleCommandEmpty>No matching help topic.</MarbleCommandEmpty>

              <MarbleCommandGroup heading="Concepts">
                <MarbleCommandItem
                  keywords={[
                    "people",
                    "personas",
                    "agents",
                  ]}
                  onSelect={() => onSelect("Profiles overview")}
                  value="Profiles overview"
                >
                  <UsersThreeIcon
                    className="text-emerald-600"
                    size={16}
                  />
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
                  onSelect={() => onSelect("Automations primer")}
                  value="Automations primer"
                >
                  <QuestionIcon
                    className="text-orange-600"
                    size={16}
                  />
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
                  onSelect={() => onSelect("Tables and schema")}
                  value="Tables and schema"
                >
                  <SquaresFourIcon
                    className="text-sky-600"
                    size={16}
                  />
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
                  onSelect={() => onSelect("Programs and inputs")}
                  value="Programs and inputs"
                >
                  <CodeIcon
                    className="text-zinc-700"
                    size={16}
                  />
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
                  onSelect={() => onSelect("Sources and syncs")}
                  value="Sources and syncs"
                >
                  <FolderOpenIcon
                    className="text-indigo-600"
                    size={16}
                  />
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
          <MarbleStat
            framed
            label="Selected topic"
            tone="neutral"
            value={selectedTopic}
          />
          <MarbleStat
            framed
            label="Try searching"
            tone="neutral"
            value="people, scheduled, columns, input, or sync"
          />
        </div>
      </MarbleCardContent>
    </MarbleCard>
  );
}
