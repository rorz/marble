"use client";

import {
  MarbleAlert,
  MarbleConfirmModal,
  type MarbleConfirmModalState,
  MarbleEditableText,
  MarblePane,
  MarblePaneEditableCrumb,
  useMarbleRouter,
} from "@marble/ui";
import { FlowArrowIcon, ListBulletsIcon } from "@phosphor-icons/react/dist/ssr";
import { useRef, useState } from "react";
import { useMarbleSdk } from "../../../../../lib/marble-sdk-client";
import {
  compareByCreatedAtCamelDesc,
  compareByUpdatedAtCamelDesc,
  sortRows,
} from "../../../../../lib/realtime-crud";
import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../change-spotlight";
import { useProjectBroadcast } from "./broadcast";
import { ProjectFlowDiagram } from "./diagram";
import { ProjectPipesSection } from "./pipes";
import { ProjectSourcesSection } from "./sources";
import { ProjectTablesSection } from "./tables";
import { type ProjectInfo, type ProjectState, sortTables } from "./types";
import { useProjectActions } from "./use-actions";

export const ProjectPageView = ({
  initialProject,
}: {
  initialProject: ProjectInfo;
}) => {
  const router = useMarbleRouter();
  const sdk = useMarbleSdk({
    profileId: initialProject.project.ownerProfileId,
  });
  const [project, setProject] = useState<ProjectState>({
    ...initialProject.project,
    tables: sortTables(initialProject.project.tables),
  });
  const [sources, setSources] = useState(() =>
    sortRows(initialProject.sources, compareByUpdatedAtCamelDesc),
  );
  const [pipes, setPipes] = useState(() =>
    sortRows(initialProject.pipes, compareByCreatedAtCamelDesc),
  );
  const [editingSurface, setEditingSurface] = useState<
    null | "crumb" | "title"
  >(null);
  const [nameDraft, setNameDraft] = useState(initialProject.project.name);
  const [creatingSource, setCreatingSource] = useState(false);
  const [creatingPipe, setCreatingPipe] = useState(false);
  const [creatingTable, setCreatingTable] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [viewMode, setViewMode] = useState<"flow" | "list">("flow");
  const [confirmState, setConfirmState] =
    useState<MarbleConfirmModalState | null>(null);

  const projectRef = useRef(project);
  projectRef.current = project;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const renameRequestRef = useRef(0);
  const renameInFlightRef = useRef(false);

  const sourceNameById = new Map(
    sources.map((source) => [
      source.id,
      source.name || "Untitled Source",
    ]),
  );
  const sourceEventCountBySourceId = new Map<string, number>();
  for (const sourceEvent of initialProject.sourceEvents) {
    sourceEventCountBySourceId.set(
      sourceEvent.sourceId,
      (sourceEventCountBySourceId.get(sourceEvent.sourceId) ?? 0) + 1,
    );
  }
  const tableLabelById = new Map(
    project.tables.map((table) => [
      table.id,
      table.name || "Untitled Table",
    ]),
  );
  const inputColumnLabelById = new Map(
    initialProject.inputColumns.map((column) => [
      column.id,
      column.name,
    ]),
  );

  useProjectBroadcast({
    project,
    projectRef,
    router,
    setNameDraft,
    setPipes,
    setProject,
    setSources,
    sourcesRef,
  });

  const actions = useProjectActions({
    nameDraft,
    project,
    projectRef,
    renameInFlightRef,
    renameRequestRef,
    router,
    sdk,
    setConfirmState,
    setCreatingPipe,
    setCreatingSource,
    setCreatingTable,
    setDeletingProject,
    setEditingSurface,
    setError,
    setNameDraft,
    setPipes,
    setProject,
    setSources,
    sources,
  });
  const viewToggleLabel =
    viewMode === "flow" ? "Show list view" : "Show flow view";
  const ViewToggleIcon = viewMode === "flow" ? ListBulletsIcon : FlowArrowIcon;
  const switchViewMode = () => {
    setViewMode((current) => (current === "flow" ? "list" : "flow"));
  };

  return (
    <MarblePane
      actions={[
        {
          "aria-label": viewToggleLabel,
          children: <span className="sr-only">{viewToggleLabel}</span>,
          iconLeft: ViewToggleIcon,
          id: "project-view-mode",
          onClick: switchViewMode,
          title: viewToggleLabel,
          variant: "light",
        },
      ]}
      crumbs={[
        {
          href: "/projects",
          id: "projects",
          label: "Projects",
        },
        {
          id: "project-name",
          label: (
            <MarblePaneEditableCrumb
              disabled={false}
              editing={editingSurface === "crumb"}
              onCancel={actions.stopEditing}
              onChange={setNameDraft}
              onCommit={() => void actions.commitName()}
              onEdit={() => actions.startEditingName("crumb")}
              value={nameDraft}
            />
          ),
        },
      ]}
      disclosureActions={[
        {
          disabled: deletingProject,
          label: deletingProject ? "Deleting..." : "Delete project",
          onSelect: actions.handleDeleteProject,
          tone: "danger",
        },
      ]}
      disclosureAriaLabel="Open project actions"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <div
          className="space-y-3"
          {...getChangeTargetProps(changeTargetKey.project(project.id))}
        >
          <MarbleEditableText
            className="-mx-1 rounded-sm px-1 text-left text-4xl tracking-tight text-zinc-950 transition-colors hover:text-orange-600"
            disabled={false}
            editing={editingSurface === "title"}
            onCancel={actions.stopEditing}
            onChange={setNameDraft}
            onCommit={() => void actions.commitName()}
            onEdit={() => actions.startEditingName("title")}
            value={nameDraft}
          />
        </div>

        {error ? <MarbleAlert tone="error">{error}</MarbleAlert> : null}

        {viewMode === "flow" ? (
          <ProjectFlowDiagram
            creatingPipe={creatingPipe}
            creatingSource={creatingSource}
            creatingTable={creatingTable}
            inputColumnLabelById={inputColumnLabelById}
            onCreatePipe={() => void actions.handleCreatePipe()}
            onCreateSource={() => void actions.handleCreateSource()}
            onCreateTable={() => void actions.handleCreateTable()}
            onSelectPipe={(pipeId) =>
              router.push(actions.buildPipeDetailHref(pipeId))
            }
            onSelectSource={(sourceId) =>
              router.push(actions.buildSourceDetailHref(sourceId))
            }
            onSelectTable={(tableId) =>
              router.push(`/projects/${project.id}/tables/${tableId}`)
            }
            pipes={pipes}
            project={project}
            sourceEventCountBySourceId={sourceEventCountBySourceId}
            sources={sources}
          />
        ) : (
          <>
            <ProjectSourcesSection
              creating={creatingSource}
              onCreate={() => void actions.handleCreateSource()}
              onRequestDelete={actions.requestDeleteSource}
              onSelect={(sourceId) =>
                router.push(actions.buildSourceDetailHref(sourceId))
              }
              sourceEventCountBySourceId={sourceEventCountBySourceId}
              sources={sources}
            />

            <ProjectPipesSection
              creating={creatingPipe}
              inputColumnLabelById={inputColumnLabelById}
              onCreate={() => void actions.handleCreatePipe()}
              onRequestDelete={actions.requestDeletePipe}
              onSelect={(pipeId) =>
                router.push(actions.buildPipeDetailHref(pipeId))
              }
              pipes={pipes}
              sourceNameById={sourceNameById}
              tableLabelById={tableLabelById}
            />

            <ProjectTablesSection
              creating={creatingTable}
              onCreate={() => void actions.handleCreateTable()}
              onRequestDelete={actions.requestDeleteTable}
              onSelect={(tableId) =>
                router.push(`/projects/${project.id}/tables/${tableId}`)
              }
              project={project}
            />
          </>
        )}
      </div>

      <MarbleConfirmModal
        onClose={() => setConfirmState(null)}
        state={confirmState}
      />
    </MarblePane>
  );
};
