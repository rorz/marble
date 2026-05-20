"use client";

import { MarbleConfirmModal, MarblePane } from "@marble/ui";
import type { ProjectSourceWorkspaceData } from "../../../../../../lib/source-data";
import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../../change-spotlight";
import { PipeSettingsCard } from "./settings";
import { usePipeDetail } from "./use-pipe-detail";

export const ProjectPipeDetailPageView = ({
  initialData,
  initialPipeId,
}: {
  initialData: ProjectSourceWorkspaceData;
  initialPipeId: string;
}) => {
  const detail = usePipeDetail({
    initialData,
    initialPipeId,
  });
  const paneTargetKey = detail.selectedPipe
    ? changeTargetKey.pipe(detail.selectedPipe.id)
    : changeTargetKey.project(detail.projectId);

  return (
    <MarblePane
      crumbs={[
        {
          href: "/projects",
          id: "projects",
          label: "Projects",
        },
        {
          href: `/projects/${detail.projectId}`,
          id: "project",
          label: detail.projectName,
        },
        {
          id: "pipe",
          label: detail.pipePageTitle,
        },
      ]}
      disclosureActions={[
        {
          disabled: detail.pipePending || !detail.selectedPipe,
          label: "Delete pipe",
          onSelect: () => void detail.handleDeletePipe(),
          tone: "danger",
        },
      ]}
      disclosureAriaLabel="Open pipe actions"
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-5"
        {...getChangeTargetProps(paneTargetKey)}
      >
        <div className="space-y-3">
          <h1 className="text-4xl tracking-tight text-zinc-950">
            {detail.pipePageTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
            <span>{detail.pipeHeaderSummary}</span>
            {detail.selectedPipe ? (
              <span className="font-mono text-xs text-zinc-400">
                {detail.selectedPipe.id}
              </span>
            ) : null}
          </div>
        </div>

        <PipeSettingsCard
          availablePipeColumns={detail.availablePipeColumns}
          configuredPipeColumnCount={detail.configuredPipeColumnCount}
          onAutoMapPipeColumns={detail.handleAutoMapPipeColumns}
          onClearPipeMappings={detail.clearPipeMappings}
          onPipeSourceIdDraftChange={detail.setPipeSourceIdDraft}
          onPipeTableIdDraftChange={detail.updatePipeTableIdDraft}
          onSavePipe={detail.handleSavePipe}
          onTogglePipeMapping={detail.togglePipeMapping}
          onUpdatePipeMapping={detail.updatePipeMapping}
          pipeCreateDisabled={detail.pipeCreateDisabled}
          pipeError={detail.pipeError}
          pipeMappingByColumnId={detail.pipeMappingByColumnId}
          pipeMappingsDraft={detail.pipeMappingsDraft}
          pipePathCandidateByNormalizedKey={
            detail.pipePathCandidateByNormalizedKey
          }
          pipePathCandidates={detail.pipePathCandidates}
          pipePathSuggestionOptions={detail.pipePathSuggestionOptions}
          pipePending={detail.pipePending}
          pipeSourceIdDraft={detail.pipeSourceIdDraft}
          pipeSuggestionSummary={detail.pipeSuggestionSummary}
          pipeTableIdDraft={detail.pipeTableIdDraft}
          sources={detail.sources}
          tableOptions={detail.tableOptions}
        />
      </div>

      <MarbleConfirmModal
        onClose={() => detail.setConfirmState(null)}
        state={detail.confirmState}
      />
    </MarblePane>
  );
};
