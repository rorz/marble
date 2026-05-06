"use client";

import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleEditableText,
  MarbleEmptyState,
  MarbleListRow,
  MarblePane,
  MarblePaneEditableCrumb,
} from "@marble/ui";
import { FunnelIcon, PipeIcon, TableIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";
import {
  pipeFromBroadcastRow,
  projectFromBroadcastRow,
  projectTableFromSdkTable,
  sourceFromBroadcastRow,
  tableFromBroadcastRow,
} from "../../../../lib/marble-resources";
import { useMarbleSdk } from "../../../../lib/marble-sdk-client";
import {
  buildPipeMappingDisplayRecords,
  buildPipeMappingSummary,
  buildPipeTitle,
} from "../../../../lib/pipe-display";
import {
  createBroadcastMutationGuard,
  type DeleteMutation,
  type UpsertMutation,
} from "../../../../lib/realtime/broadcast-mutations";
import { usePrivateBroadcast } from "../../../../lib/realtime/private-broadcast";
import {
  compareByCreatedAtCamelDesc,
  compareByUpdatedAtCamelDesc,
  getErrorMessage,
  removeRow,
  sortRows,
  upsertRow,
} from "../../../../lib/realtime-crud";
import type { ProjectSourceWorkspaceData } from "../../../../lib/source-data";
import { changeTargetKey, getChangeTargetProps } from "../../change-spotlight";

type ProjectInfo = ProjectSourceWorkspaceData;
type ProjectState = ProjectInfo["project"];
type BroadcastRow = Record<string, unknown>;
type ProjectMutation =
  | DeleteMutation<"pipe:delete", BroadcastRow>
  | UpsertMutation<"pipe:upsert", BroadcastRow>
  | DeleteMutation<"project:delete", BroadcastRow>
  | UpsertMutation<"project:upsert", BroadcastRow>
  | DeleteMutation<"source:delete", BroadcastRow>
  | UpsertMutation<"source:upsert", BroadcastRow>
  | DeleteMutation<"table:delete", BroadcastRow>
  | UpsertMutation<"table:upsert", BroadcastRow>;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function buildSectionHeading(label: string, count: number) {
  return count > 0 ? `${label} (${count})` : label;
}

const projectMutationTypes = {
  "pipe:delete": true,
  "pipe:upsert": true,
  "project:delete": true,
  "project:upsert": true,
  "source:delete": true,
  "source:upsert": true,
  "table:delete": true,
  "table:upsert": true,
} satisfies Record<ProjectMutation["type"], true>;

const isProjectMutation =
  createBroadcastMutationGuard<ProjectMutation>(projectMutationTypes);

function ResourceEmptyStateIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-14 items-center justify-center rounded-full border border-orange-200/40 bg-orange-50/35 text-orange-500/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      {children}
    </div>
  );
}

function sortTables(tables: ProjectState["tables"]) {
  return sortRows(tables, compareByUpdatedAtCamelDesc);
}

export function ProjectPageView({
  initialProject,
}: {
  initialProject: ProjectInfo;
}) {
  const router = useRouter();
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

  for (const sourceEvent of initialProject.sourceEvents) {
    sourceEventCountBySourceId.set(
      sourceEvent.sourceId,
      (sourceEventCountBySourceId.get(sourceEvent.sourceId) ?? 0) + 1,
    );
  }

  const buildSourceDetailHref = (sourceId: string) => {
    return `/projects/${project.id}/sources/${sourceId}`;
  };

  const buildPipeDetailHref = (pipeId: string) => {
    return `/projects/${project.id}/pipes/${pipeId}`;
  };

  usePrivateBroadcast({
    event: "project_mutation",
    label: "Project",
    onMessage: (mutation) => {
      if (!isProjectMutation(mutation)) {
        return;
      }

      switch (mutation.type) {
        case "project:delete":
          if (mutation.id === project.id) {
            router.push("/projects");
          }
          break;

        case "project:upsert": {
          const next = projectFromBroadcastRow(mutation.row);

          if (next.id !== project.id) {
            return;
          }

          setProject((current) => ({
            ...current,
            ...next,
            tableCount: current.tableCount,
            tables: current.tables,
          }));
          setNameDraft(next.name);
          break;
        }

        case "table:delete":
          setProject((current) => {
            const tables = removeRow(current.tables, mutation.id);

            return tables.length === current.tables.length
              ? current
              : {
                  ...current,
                  tableCount: tables.length,
                  tables,
                };
          });
          break;

        case "table:upsert":
          setProject((current) => {
            const next = tableFromBroadcastRow(mutation.row);

            if (next.projectId !== current.id) {
              return current;
            }

            const tables = upsertRow(
              current.tables,
              projectTableFromSdkTable(next, current),
              compareByUpdatedAtCamelDesc,
            );

            return {
              ...current,
              tableCount: tables.length,
              tables,
            };
          });
          break;

        case "source:delete":
          setSources((current) => removeRow(current, mutation.id));
          break;

        case "source:upsert": {
          const next = sourceFromBroadcastRow(mutation.row);

          if (next.projectId !== project.id) {
            return;
          }

          setSources((current) =>
            upsertRow(current, next, compareByUpdatedAtCamelDesc),
          );
          break;
        }

        case "pipe:delete":
          setPipes((current) => removeRow(current, mutation.id));
          break;

        case "pipe:upsert": {
          const next = pipeFromBroadcastRow(mutation.row);
          const belongsToProject =
            projectRef.current.tables.some(
              (table) => table.id === next.tableId,
            ) ||
            sourcesRef.current.some((source) => source.id === next.sourceId);

          if (!belongsToProject) {
            return;
          }

          setPipes((current) =>
            upsertRow(current, next, compareByCreatedAtCamelDesc),
          );
          break;
        }
      }
    },
    topic: `project:${project.id}`,
  });

  const stopEditing = () => {
    setEditingSurface(null);
    setNameDraft(project.name);
  };

  const commitName = async () => {
    const nextName = nameDraft.trim() || "Untitled Project";
    const previousProject = projectRef.current;

    if (nextName === previousProject.name) {
      setEditingSurface(null);
      setNameDraft(previousProject.name);
      return;
    }

    const requestId = renameRequestRef.current + 1;
    renameRequestRef.current = requestId;
    renameInFlightRef.current = true;
    setError(null);
    setEditingSurface(null);
    setNameDraft(nextName);
    setProject((current) => ({
      ...current,
      name: nextName,
    }));

    try {
      const updated = await sdk.projects.update({
        projectId: previousProject.id,
        values: {
          name: nextName,
        },
      });
      if (renameRequestRef.current !== requestId) {
        return;
      }

      setProject((current) => ({
        ...current,
        name: updated.name,
        updatedAt: updated.updatedAt,
      }));
      setNameDraft(updated.name);
    } catch (caughtError) {
      if (renameRequestRef.current !== requestId) {
        return;
      }

      setProject((current) => ({
        ...current,
        name: previousProject.name,
        updatedAt: previousProject.updatedAt,
      }));
      setNameDraft(previousProject.name);
      setError(getErrorMessage(caughtError));
    } finally {
      if (renameRequestRef.current === requestId) {
        renameInFlightRef.current = false;
      }
    }
  };

  const startEditingName = (surface: "crumb" | "title") => {
    if (renameInFlightRef.current) {
      return;
    }

    setEditingSurface(surface);
  };

  const handleCreateTable = async () => {
    setCreatingTable(true);
    setError(null);

    try {
      const table = await sdk.tables.create({
        projectId: project.id,
      });
      router.push(`/projects/${project.id}/tables/${table.id}`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setCreatingTable(false);
    }
  };

  const handleCreateSource = async () => {
    setCreatingSource(true);
    setError(null);

    try {
      const source = await sdk.sources.create({
        projectId: project.id,
      });
      setSources((current) =>
        upsertRow(current, source, compareByUpdatedAtCamelDesc),
      );
      router.push(buildSourceDetailHref(source.id));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setCreatingSource(false);
    }
  };

  const handleCreatePipe = async () => {
    const sourceId = sources[0]?.id;
    const tableId = project.tables[0]?.id;

    if (!sourceId || !tableId) {
      setError(
        "Create at least one source and one table before adding a pipe.",
      );
      return;
    }

    setCreatingPipe(true);
    setError(null);

    try {
      const pipe = await sdk.pipes.create({
        mappings: [],
        sourceId,
        tableId,
      });
      setPipes((current) =>
        upsertRow(current, pipe, compareByCreatedAtCamelDesc),
      );
      router.push(buildPipeDetailHref(pipe.id));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setCreatingPipe(false);
    }
  };

  const handleDeleteProject = async () => {
    if (
      !window.confirm(
        `Delete ${project.name}? This also removes its tables and related data.`,
      )
    ) {
      return;
    }

    setDeletingProject(true);
    setError(null);

    try {
      await sdk.projects.delete({
        projectId: project.id,
      });
      router.push("/projects");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setDeletingProject(false);
    }
  };

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
              onCancel={stopEditing}
              onChange={setNameDraft}
              onCommit={() => void commitName()}
              onEdit={() => startEditingName("crumb")}
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
            onCancel={stopEditing}
            onChange={setNameDraft}
            onCommit={() => void commitName()}
            onEdit={() => startEditingName("title")}
            value={nameDraft}
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
            <span>{project.tableCount} tables</span>
            <span>{sources.length} sources</span>
            <span>{pipes.length} pipes</span>
            <span>{project.folderPath.join(" / ") || "Root"}</span>
            <span>{DATE_FORMATTER.format(new Date(project.updatedAt))}</span>
          </div>
        </div>

        {error ? <MarbleAlert tone="error">{error}</MarbleAlert> : null}

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl tracking-tight text-zinc-950">
                {buildSectionHeading("Sources", sources.length)}
              </h2>
            </div>
            <MarbleButton
              disabled={creatingSource}
              onClick={() => void handleCreateSource()}
              size="sm"
              variant="light"
            >
              {creatingSource ? "Creating" : "New source"}
            </MarbleButton>
          </div>

          <MarbleCard>
            {sources.length === 0 ? (
              <MarbleCardContent>
                <MarbleEmptyState
                  description="Create a source to capture incoming webhook payloads."
                  icon={
                    <ResourceEmptyStateIcon>
                      <FunnelIcon
                        size={26}
                        weight="duotone"
                      />
                    </ResourceEmptyStateIcon>
                  }
                  title="No sources yet"
                />
              </MarbleCardContent>
            ) : (
              <MarbleCardContent className="p-0">
                {sources.map((source) => (
                  <MarbleListRow
                    description={`${sourceEventCountBySourceId.get(source.id) ?? 0} events captured`}
                    key={source.id}
                    onClick={() =>
                      router.push(buildSourceDetailHref(source.id))
                    }
                    title={source.name || "Untitled Source"}
                    {...getChangeTargetProps(changeTargetKey.source(source.id))}
                  />
                ))}
              </MarbleCardContent>
            )}
          </MarbleCard>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl tracking-tight text-zinc-950">
                {buildSectionHeading("Pipes", pipes.length)}
              </h2>
            </div>
            <MarbleButton
              disabled={creatingPipe}
              onClick={() => void handleCreatePipe()}
              size="sm"
              variant="light"
            >
              {creatingPipe ? "Creating" : "New pipe"}
            </MarbleButton>
          </div>

          <MarbleCard>
            {pipes.length === 0 ? (
              <MarbleCardContent>
                <MarbleEmptyState
                  description="Create a pipe to map captured payloads into table inputs."
                  icon={
                    <ResourceEmptyStateIcon>
                      <PipeIcon
                        size={26}
                        weight="duotone"
                      />
                    </ResourceEmptyStateIcon>
                  }
                  title="No pipes yet"
                />
              </MarbleCardContent>
            ) : (
              <MarbleCardContent className="p-0">
                {pipes.map((pipe) => {
                  const pipeMappings = buildPipeMappingDisplayRecords(
                    pipe.mappings,
                    inputColumnLabelById,
                  );
                  const visiblePipeMappings = pipeMappings.slice(0, 4);
                  const hiddenPipeMappingCount =
                    pipeMappings.length - visiblePipeMappings.length;

                  return (
                    <MarbleListRow
                      align="start"
                      description={
                        pipeMappings.length > 0 ? (
                          <>
                            {visiblePipeMappings.map((mapping) => (
                              <MarbleBadge
                                className="gap-1 rounded-full border-zinc-200 bg-zinc-50 px-2 py-1 font-medium text-zinc-700"
                                key={`${mapping.jsonPath}:${mapping.columnId}`}
                              >
                                <span className="font-mono text-[10px] text-zinc-600">
                                  {mapping.jsonPathLabel}
                                </span>
                                <span className="text-zinc-400">{"->"}</span>
                                <span className="text-zinc-950">
                                  {mapping.columnLabel}
                                </span>
                              </MarbleBadge>
                            ))}

                            {hiddenPipeMappingCount > 0 ? (
                              <MarbleBadge className="rounded-full border-zinc-200 bg-zinc-50 px-2 py-1 font-medium text-zinc-600">
                                +{hiddenPipeMappingCount} more
                              </MarbleBadge>
                            ) : null}
                          </>
                        ) : (
                          buildPipeMappingSummary(
                            pipe.mappings,
                            inputColumnLabelById,
                          )
                        )
                      }
                      descriptionClassName={
                        pipeMappings.length > 0
                          ? "mt-2 flex flex-wrap items-center gap-1.5 text-xs"
                          : "mt-1 text-xs text-zinc-500"
                      }
                      key={pipe.id}
                      onClick={() => router.push(buildPipeDetailHref(pipe.id))}
                      title={buildPipeTitle({
                        sourceLabel: sourceNameById.get(pipe.sourceId),
                        tableLabel: tableLabelById.get(pipe.tableId),
                      })}
                      {...getChangeTargetProps(changeTargetKey.pipe(pipe.id))}
                    />
                  );
                })}
              </MarbleCardContent>
            )}
          </MarbleCard>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl tracking-tight text-zinc-950">
                {buildSectionHeading("Tables", project.tableCount)}
              </h2>
            </div>
            <MarbleButton
              disabled={creatingTable}
              onClick={handleCreateTable}
              size="sm"
              variant="light"
            >
              {creatingTable ? "Creating" : "New table"}
            </MarbleButton>
          </div>

          <MarbleCard>
            {project.tables.length === 0 ? (
              <MarbleCardContent>
                <MarbleEmptyState
                  description="Create a table to build rows and columns."
                  icon={
                    <ResourceEmptyStateIcon>
                      <TableIcon
                        size={26}
                        weight="duotone"
                      />
                    </ResourceEmptyStateIcon>
                  }
                  title="No tables yet"
                />
              </MarbleCardContent>
            ) : (
              <MarbleCardContent className="p-0">
                {project.tables.map((table) => (
                  <MarbleListRow
                    description={`Updated ${DATE_FORMATTER.format(new Date(table.updatedAt))}`}
                    key={table.id}
                    onClick={() =>
                      router.push(`/projects/${project.id}/tables/${table.id}`)
                    }
                    title={table.name || "Untitled Table"}
                    {...getChangeTargetProps(changeTargetKey.table(table.id))}
                  />
                ))}
              </MarbleCardContent>
            )}
          </MarbleCard>
        </div>

        <div className="flex justify-end">
          <MarbleButton
            disabled={deletingProject}
            onClick={handleDeleteProject}
            variant="red"
          >
            {deletingProject ? "Deleting" : "Delete project"}
          </MarbleButton>
        </div>
      </div>
    </MarblePane>
  );
}
