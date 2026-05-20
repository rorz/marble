"use client";

import {
  MarbleAlert,
  MarbleConfirmModal,
  MarbleEditableText,
  MarblePane,
  MarblePaneEditableCrumb,
} from "@marble/ui";
import type { ProjectSourceWorkspaceData } from "../../../../../../lib/source-data";
import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../../change-spotlight";
import { SourceEventsCard } from "./events";
import { SourceSettingsCard } from "./settings";
import { useSourceDetail } from "./use-source-detail";

export const ProjectSourceDetailPageView = ({
  initialData,
  initialSourceId,
}: {
  initialData: ProjectSourceWorkspaceData;
  initialSourceId: string;
}) => {
  const detail = useSourceDetail({
    initialData,
    initialSourceId,
  });
  const paneTargetKey = detail.selectedSource
    ? changeTargetKey.source(detail.selectedSource.id)
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
          id: "source",
          label: (
            <MarblePaneEditableCrumb
              disabled={!detail.selectedSource}
              editing={detail.sourceEditingSurface === "crumb"}
              onCancel={detail.stopEditingSourceName}
              onChange={detail.setSourceNameDraft}
              onCommit={() => void detail.commitSourceName()}
              onEdit={() => detail.setSourceEditingSurface("crumb")}
              value={detail.sourceNameDraft}
            />
          ),
        },
      ]}
      disclosureActions={[
        {
          disabled: detail.sourcePending || !detail.selectedSource,
          label: "Delete source",
          onSelect: () => void detail.handleDeleteSource(),
          tone: "danger",
        },
      ]}
      disclosureAriaLabel="Open source actions"
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-5"
        {...getChangeTargetProps(paneTargetKey)}
      >
        <div className="space-y-3">
          <MarbleEditableText
            className="-mx-1 rounded-sm px-1 text-left text-4xl tracking-tight text-zinc-950 transition-colors hover:text-orange-600"
            disabled={!detail.selectedSource}
            editing={detail.sourceEditingSurface === "title"}
            onCancel={detail.stopEditingSourceName}
            onChange={detail.setSourceNameDraft}
            onCommit={() => void detail.commitSourceName()}
            onEdit={() => detail.setSourceEditingSurface("title")}
            value={detail.sourceNameDraft}
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
            <span>{detail.selectedSourceEvents.length} events captured</span>
            {detail.selectedSource ? (
              <span className="font-mono text-xs text-zinc-400">
                {detail.selectedSource.id}
              </span>
            ) : null}
          </div>
        </div>

        {detail.sourceRenameError ? (
          <MarbleAlert tone="error">{detail.sourceRenameError}</MarbleAlert>
        ) : null}

        <div className="grid min-h-0 flex-1 items-stretch gap-5 xl:grid-cols-[minmax(22rem,0.95fr)_minmax(0,1.15fr)]">
          <SourceSettingsCard
            onInferSourceSchema={detail.handleInferSourceSchema}
            onSaveSource={detail.handleSaveSource}
            onSourceSchemaDraftChange={detail.updateSourceSchemaDraft}
            selectedSource={detail.selectedSource}
            selectedSourceEvent={detail.selectedSourceEvent}
            sourcePending={detail.sourcePending}
            sourceSchemaDraft={detail.sourceSchemaDraft}
            sourceSchemaError={detail.sourceSchemaError}
            sourceSchemaInferPending={detail.sourceSchemaInferPending}
            sourceSchemaValid={detail.sourceSchemaValidation.ok}
            webhookBaseUrl={initialData.webhookBaseUrl}
          />

          <SourceEventsCard
            onSelectSourceEvent={detail.setSelectedSourceEventId}
            selectedSource={detail.selectedSource}
            selectedSourceEvent={detail.selectedSourceEvent}
            selectedSourceEvents={detail.selectedSourceEvents}
          />
        </div>
      </div>

      <MarbleConfirmModal
        onClose={() => detail.setConfirmState(null)}
        state={detail.confirmState}
      />
    </MarblePane>
  );
};
