"use client";

import type { Database } from "@marble/supabase";
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
import { type ReactNode, useEffect, useRef, useState } from "react";
import { callMarbleClient } from "../../../../lib/marble-client";
import {
  buildPipeMappingDisplayRecords,
  buildPipeMappingSummary,
  buildPipeTitle,
} from "../../../../lib/pipe-display";
import {
  compareByCreatedAtDesc,
  compareByUpdatedAtDesc,
  getErrorMessage,
  type RealtimePayload,
  removeRow,
  sortRows,
  upsertRow,
} from "../../../../lib/realtime-crud";
import type { ProjectSourceWorkspaceData } from "../../../../lib/source-data";
import { createClient } from "../../../../lib/supabase/browser";
import { changeTargetKey, getChangeTargetProps } from "../../change-spotlight";

type ProjectInfo = ProjectSourceWorkspaceData;
type ProjectState = ProjectInfo["project"];
type ProjectRecord = Database["public"]["Tables"]["project"]["Row"];
type TableRecord = Database["public"]["Tables"]["table"]["Row"];
type SourceRecord = Database["public"]["Tables"]["source"]["Row"];
type PipeRecord = Database["public"]["Tables"]["pipe"]["Row"];

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function buildSectionHeading(label: string, count: number) {
  return count > 0 ? `${label} (${count})` : label;
}

function ResourceEmptyStateIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-14 items-center justify-center rounded-full border border-orange-200/40 bg-orange-50/35 text-orange-500/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      {children}
    </div>
  );
}

function sortTables(tables: ProjectState["tables"]) {
  return sortRows(tables, compareByUpdatedAtDesc);
}

function renameProject(projectId: string, name: string) {
  return callMarbleClient<ProjectRecord>(`/projects/${projectId}`, {
    body: {
      name: name.trim() || "Untitled Project",
    },
    method: "PATCH",
  });
}

function createTable(projectId: string) {
  return callMarbleClient<TableRecord>(`/projects/${projectId}/tables`, {
    method: "POST",
  });
}

function createSource(projectId: string) {
  return callMarbleClient<SourceRecord>(`/projects/${projectId}/sources`, {
    method: "POST",
  });
}

function createPipe(
  projectId: string,
  input: {
    mappings: never[];
    sourceId: string;
    tableId: string;
  },
) {
  return callMarbleClient<PipeRecord>(`/projects/${projectId}/pipes`, {
    body: input,
    method: "POST",
  });
}

function deleteProject(projectId: string) {
  return callMarbleClient(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

export function ProjectPageView({
  initialProject,
}: {
  initialProject: ProjectInfo;
}) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectState>({
    ...initialProject.project,
    tables: sortTables(initialProject.project.tables),
  });
  const [sources, setSources] = useState(() =>
    sortRows(initialProject.sources, compareByUpdatedAtDesc),
  );
  const [pipes, setPipes] = useState(() =>
    sortRows(initialProject.pipes, compareByCreatedAtDesc),
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
      sourceEvent.source_id,
      (sourceEventCountBySourceId.get(sourceEvent.source_id) ?? 0) + 1,
    );
  }

  const buildSourceDetailHref = (sourceId: string) => {
    return `/projects/${project.id}/sources/${sourceId}`;
  };

  const buildPipeDetailHref = (pipeId: string) => {
    return `/projects/${project.id}/pipes/${pipeId}`;
  };

  useEffect(() => {
    const supabase = createClient();
    const projectChannel = supabase
      .channel(`project:${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project",
        },
        (payload) => {
          const change = payload as RealtimePayload<ProjectRecord>;

          if (change.eventType === "DELETE" && change.old.id === project.id) {
            router.push("/projects");
            return;
          }

          const next = change.new as ProjectRecord;

          if (next.id !== project.id) {
            return;
          }

          setProject((current) => ({
            ...current,
            ...next,
            table_count: current.table_count,
            tables: current.tables,
          }));
          setNameDraft(next.name);
        },
      )
      .subscribe();

    const tableChannel = supabase
      .channel(`project:${project.id}:tables`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table",
        },
        (payload) => {
          const change = payload as RealtimePayload<TableRecord>;

          setProject((current) => {
            if (
              change.eventType === "DELETE" &&
              change.old.project_id === current.id &&
              typeof change.old.id === "string"
            ) {
              const tables = removeRow(current.tables, change.old.id);

              return {
                ...current,
                table_count: tables.length,
                tables,
              };
            }

            const next = change.new as TableRecord;

            if (next.project_id !== current.id) {
              return current;
            }

            const tables = upsertRow(
              current.tables,
              {
                ...next,
                project_folder_path: current.folder_path,
                project_name: current.name,
              },
              compareByUpdatedAtDesc,
            );

            return {
              ...current,
              table_count: tables.length,
              tables,
            };
          });
        },
      )
      .subscribe();

    const sourceChannel = supabase
      .channel(`project:${project.id}:sources`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "source",
        },
        (payload) => {
          const change = payload as RealtimePayload<SourceRecord>;

          setSources((current) => {
            if (
              change.eventType === "DELETE" &&
              change.old.project_id === project.id &&
              typeof change.old.id === "string"
            ) {
              return removeRow(current, change.old.id);
            }

            const next = change.new as SourceRecord;

            if (next.project_id !== project.id) {
              return current;
            }

            return upsertRow(current, next, compareByUpdatedAtDesc);
          });
        },
      )
      .subscribe();

    const pipeChannel = supabase
      .channel(`project:${project.id}:pipes`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipe",
        },
        (payload) => {
          const change = payload as RealtimePayload<PipeRecord>;

          setPipes((current) => {
            if (
              change.eventType === "DELETE" &&
              typeof change.old.id === "string"
            ) {
              return removeRow(current, change.old.id);
            }

            const next = change.new as PipeRecord;
            const belongsToProject =
              projectRef.current.tables.some(
                (table) => table.id === next.table_id,
              ) ||
              sourcesRef.current.some((source) => source.id === next.source_id);

            if (!belongsToProject) {
              return current;
            }

            return upsertRow(current, next, compareByCreatedAtDesc);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(projectChannel);
      void supabase.removeChannel(tableChannel);
      void supabase.removeChannel(sourceChannel);
      void supabase.removeChannel(pipeChannel);
    };
  }, [
    project.id,
    router,
  ]);

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
      const updated = await renameProject(previousProject.id, nextName);
      if (renameRequestRef.current !== requestId) {
        return;
      }

      setProject((current) => ({
        ...current,
        name: updated.name,
        updated_at: updated.updated_at,
      }));
      setNameDraft(updated.name);
    } catch (caughtError) {
      if (renameRequestRef.current !== requestId) {
        return;
      }

      setProject((current) => ({
        ...current,
        name: previousProject.name,
        updated_at: previousProject.updated_at,
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
      const table = await createTable(project.id);
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
      const source = await createSource(project.id);
      setSources((current) =>
        upsertRow(current, source, compareByUpdatedAtDesc),
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
      const pipe = await createPipe(project.id, {
        mappings: [],
        sourceId,
        tableId,
      });
      setPipes((current) => upsertRow(current, pipe, compareByCreatedAtDesc));
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
      await deleteProject(project.id);
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
            <span>{project.table_count} tables</span>
            <span>{sources.length} sources</span>
            <span>{pipes.length} pipes</span>
            <span>{project.folder_path.join(" / ") || "Root"}</span>
            <span>{DATE_FORMATTER.format(new Date(project.updated_at))}</span>
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
                        sourceLabel: sourceNameById.get(pipe.source_id),
                        tableLabel: tableLabelById.get(pipe.table_id),
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
                {buildSectionHeading("Tables", project.table_count)}
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
                    description={`Updated ${DATE_FORMATTER.format(new Date(table.updated_at))}`}
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
