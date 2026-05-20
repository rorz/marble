import { normalizeDisplayLabel } from "@marble/lib/string";
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
  MarbleEmptyState,
  MarblePane,
  MarbleTabs,
  MarbleTabsContent,
  MarbleTabsList,
  MarbleTabsTrigger,
} from "@marble/ui";
import {
  CodeIcon,
  FilePlusIcon,
  GitBranchIcon,
  MagnifyingGlassIcon,
  SparkleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { changeTargetKey, getChangeTargetProps } from "../../change-spotlight";
import { DATE_FORMATTER } from "./constants";
import { countLabel, getLatestPublishedVersion } from "./programs";
import type {
  FullProgram,
  LibrarySurface,
  ProgramsLibraryViewModel,
} from "./types";

const isLibrarySurface = (value: string): value is LibrarySurface =>
  value === "mine" || value === "system" || value === "marketplace";

const ProgramCard = ({
  forking,
  onFork,
  onOpen,
  program,
}: Readonly<{
  forking: boolean;
  onFork: (program: FullProgram) => void;
  onOpen: (programId: string) => void;
  program: FullProgram;
}>) => {
  const latestVersion = getLatestPublishedVersion(program);
  const title = normalizeDisplayLabel(program.name, "Untitled Program");

  return (
    <MarbleCard>
      <MarbleCardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <MarbleCardTitle className="truncate">{title}</MarbleCardTitle>
            <MarbleCardDescription className="mt-1">
              {program.firstParty
                ? "Read-only system program. Fork it to customize."
                : "User-made program you can edit and publish."}
            </MarbleCardDescription>
          </div>
          <MarbleBadge tone={program.firstParty ? "info" : "solid"}>
            {program.firstParty ? "System" : "Mine"}
          </MarbleBadge>
        </div>
      </MarbleCardHeader>
      <MarbleCardContent className="min-h-0 flex-1 justify-end gap-3 text-sm text-taupe-600">
        <div>
          <div className="text-eyebrow-xs text-taupe-500">Latest</div>
          <div className="mt-1 font-medium text-taupe-900">
            {latestVersion
              ? `Published v${latestVersion.version}`
              : "No version"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span>
            {latestVersion
              ? countLabel(latestVersion.programFiles.length, "file")
              : "No files"}
          </span>
          <span>{DATE_FORMATTER.format(new Date(program.updatedAt))}</span>
        </div>
      </MarbleCardContent>
      <MarbleCardFooter className="flex-wrap">
        {program.firstParty ? (
          <MarbleButton
            disabled={forking}
            iconLeft={GitBranchIcon}
            onClick={() => onFork(program)}
            size="sm"
            type="button"
            variant="orange"
          >
            {forking ? "Forking..." : "Fork"}
          </MarbleButton>
        ) : null}
        <MarbleButton
          iconLeft={CodeIcon}
          onClick={() => onOpen(program.id)}
          size="sm"
          type="button"
          variant={program.firstParty ? "light" : "dark"}
        >
          Open
        </MarbleButton>
      </MarbleCardFooter>
    </MarbleCard>
  );
};

const ProgramMarketplacePlaceholder = () => (
  <MarbleCard tone="subtle">
    <MarbleCardContent>
      <MarbleEmptyState
        description="A searchable catalog of installable programs will live here."
        icon={<MagnifyingGlassIcon size={18} />}
        iconTone="neutral"
        title="Program marketplace is coming soon"
      />
    </MarbleCardContent>
  </MarbleCard>
);

const MyProgramsEmptyState = ({
  createPending,
  onAskAgent,
  onCreate,
}: Readonly<{
  createPending: boolean;
  onAskAgent: () => void;
  onCreate: () => void;
}>) => (
  <MarbleCard>
    <MarbleCardContent>
      <MarbleEmptyState
        actions={
          <div className="flex flex-wrap justify-center gap-2">
            <MarbleButton
              iconLeft={SparkleIcon}
              onClick={onAskAgent}
              size="sm"
              type="button"
              variant="dark"
            >
              Ask agent
            </MarbleButton>
            <MarbleButton
              disabled={createPending}
              iconLeft={FilePlusIcon}
              onClick={onCreate}
              size="sm"
              type="button"
              variant="orange"
            >
              {createPending ? "Creating..." : "Create manually"}
            </MarbleButton>
          </div>
        }
        description="Ask your agent to create one, or create one manually."
        icon={<CodeIcon size={18} />}
        iconTone="orange"
        title="No programs yet"
      />
    </MarbleCardContent>
  </MarbleCard>
);

const SystemProgramsEmptyState = () => (
  <MarbleCard>
    <MarbleCardContent>
      <MarbleEmptyState
        description="System programs will appear here when they are available."
        icon={<SparkleIcon size={18} />}
        iconTone="neutral"
        title="No system programs yet"
      />
    </MarbleCardContent>
  </MarbleCard>
);

const ProgramGrid = ({
  forkingProgramId,
  onFork,
  onOpen,
  programs,
}: Readonly<{
  forkingProgramId: null | string;
  onFork: (program: FullProgram) => void;
  onOpen: (programId: string) => void;
  programs: FullProgram[];
}>) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {programs.map((program) => (
      <div
        key={program.id}
        {...getChangeTargetProps(changeTargetKey.program(program.id))}
      >
        <ProgramCard
          forking={forkingProgramId === program.id}
          onFork={onFork}
          onOpen={onOpen}
          program={program}
        />
      </div>
    ))}
  </div>
);

export const ProgramsLibraryView = ({
  model,
}: Readonly<{
  model: ProgramsLibraryViewModel;
}>) => (
  <MarblePane
    actions={[
      {
        children: model.createPending ? "Creating..." : "New program",
        disabled: model.createPending,
        id: "new-program",
        onClick: model.onCreateProgram,
        variant: "orange",
      },
    ]}
    crumbs={[
      {
        id: "programs",
        label: "Programs",
      },
    ]}
    width="ExtraWide"
  >
    <div className="space-y-5">
      {model.createError ? (
        <MarbleAlert tone="error">{model.createError}</MarbleAlert>
      ) : null}

      <MarbleTabs
        onValueChange={(value) => {
          if (isLibrarySurface(value)) {
            model.onSurfaceChange(value);
          }
        }}
        value={model.librarySurface}
      >
        <MarbleTabsList>
          <MarbleTabsTrigger
            badge={model.customPrograms.length}
            value="mine"
          >
            My programs
          </MarbleTabsTrigger>
          <MarbleTabsTrigger
            badge={model.systemPrograms.length}
            value="system"
          >
            System programs
          </MarbleTabsTrigger>
          <MarbleTabsTrigger value="marketplace">
            Program marketplace
          </MarbleTabsTrigger>
        </MarbleTabsList>

        <MarbleTabsContent value="mine">
          {model.customPrograms.length === 0 ? (
            <MyProgramsEmptyState
              createPending={model.createPending}
              onAskAgent={model.onAskAgentToCreateProgram}
              onCreate={model.onCreateProgram}
            />
          ) : (
            <ProgramGrid
              forkingProgramId={model.forkingProgramId}
              onFork={model.onForkProgram}
              onOpen={model.onOpenProgram}
              programs={model.customPrograms}
            />
          )}
        </MarbleTabsContent>

        <MarbleTabsContent value="system">
          {model.systemPrograms.length === 0 ? (
            <SystemProgramsEmptyState />
          ) : (
            <ProgramGrid
              forkingProgramId={model.forkingProgramId}
              onFork={model.onForkProgram}
              onOpen={model.onOpenProgram}
              programs={model.systemPrograms}
            />
          )}
        </MarbleTabsContent>

        <MarbleTabsContent value="marketplace">
          <ProgramMarketplacePlaceholder />
        </MarbleTabsContent>
      </MarbleTabs>
    </div>
  </MarblePane>
);
