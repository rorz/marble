"use client";

import {
  MarbleAlert,
  MarbleButton,
  MarbleConfirmModal,
  type MarbleConfirmModalState,
  MarbleEditableText,
  MarblePane,
  MarblePaneEditableCrumb,
  useMarbleRouter,
} from "@marble/ui";
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
import { ProjectPipesSection } from "./pipes";
import { ProjectSourcesSection } from "./sources";
import { ProjectTablesSection } from "./tables";
import { type ProjectInfo, type ProjectState, sortTables } from "./types";
import { useProjectActions } from "./use-actions";

export function ProjectPageView({
  initialProject,
}: {
  initialProject: ProjectInfo;
}) {
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

  return (
    <MarblePane
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
    >
      <div className="space-y-6">
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

        <div className="flex justify-end">
          <MarbleButton
            disabled={deletingProject}
            onClick={actions.handleDeleteProject}
            variant="red"
          >
            {deletingProject ? "Deleting" : "Delete project"}
          </MarbleButton>
        </div>
      </div>

      <MarbleConfirmModal
        onClose={() => setConfirmState(null)}
        state={confirmState}
      />
    </MarblePane>
  );
}
