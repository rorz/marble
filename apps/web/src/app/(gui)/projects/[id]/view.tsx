"use client";

import {
  MarbleAlert,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleEditableText,
  MarbleEmptyState,
  MarbleListRow,
  MarblePane,
  MarblePaneEditableCrumb,
} from "@marble/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  compareByUpdatedAtDesc,
  getErrorMessage,
  type RealtimePayload,
  removeRow,
  sortRows,
  upsertRow,
} from "../../../../lib/realtime-crud";
import { createClient } from "../../../../lib/supabase/browser";
import {
  createTableAction,
  deleteProjectAction,
  renameProjectAction,
} from "../actions";

type ProjectInfo = Awaited<ReturnType<typeof import("../actions").loadProject>>;
type ProjectRecord = Awaited<ReturnType<typeof renameProjectAction>>;
type TableRecord = Awaited<ReturnType<typeof createTableAction>>;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function sortTables(tables: ProjectInfo["tables"]) {
  return sortRows(tables, compareByUpdatedAtDesc);
}

export function ProjectPageView({
  initialProject,
}: {
  initialProject: ProjectInfo;
}) {
  const router = useRouter();
  const [project, setProject] = useState({
    ...initialProject,
    tables: sortTables(initialProject.tables),
  });
  const [editingSurface, setEditingSurface] = useState<
    null | "crumb" | "title"
  >(null);
  const [nameDraft, setNameDraft] = useState(initialProject.name);
  const [savingName, setSavingName] = useState(false);
  const [creatingTable, setCreatingTable] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [error, setError] = useState<null | string>(null);

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

    return () => {
      void supabase.removeChannel(projectChannel);
      void supabase.removeChannel(tableChannel);
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

    if (nextName === project.name) {
      setEditingSurface(null);
      setNameDraft(project.name);
      return;
    }

    setSavingName(true);
    setError(null);

    try {
      const updated = await renameProjectAction(project.id, nextName);
      setProject((current) => ({
        ...current,
        name: updated.name,
        updated_at: updated.updated_at,
      }));
      setNameDraft(updated.name);
      setEditingSurface(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSavingName(false);
    }
  };

  const handleCreateTable = async () => {
    setCreatingTable(true);
    setError(null);

    try {
      const table = await createTableAction(project.id);
      router.push(`/projects/${project.id}/tables/${table.id}`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setCreatingTable(false);
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
      await deleteProjectAction(project.id);
      router.push("/projects");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setDeletingProject(false);
    }
  };

  return (
    <MarblePane
      actions={[
        {
          children: creatingTable ? "Creating" : "New table",
          disabled: creatingTable,
          id: "create-table",
          onClick: handleCreateTable,
          variant: "dark",
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
              disabled={savingName}
              editing={editingSurface === "crumb"}
              onCancel={stopEditing}
              onChange={setNameDraft}
              onCommit={() => void commitName()}
              onEdit={() => setEditingSurface("crumb")}
              value={nameDraft}
            />
          ),
        },
      ]}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <MarbleEditableText
            className="-mx-1 rounded-sm px-1 text-left text-4xl tracking-tight text-zinc-950 transition-colors hover:text-orange-600"
            disabled={savingName}
            editing={editingSurface === "title"}
            onCancel={stopEditing}
            onChange={setNameDraft}
            onCommit={() => void commitName()}
            onEdit={() => setEditingSurface("title")}
            value={nameDraft}
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
            <span>{project.table_count} tables</span>
            <span>{project.folder_path.join(" / ") || "Root"}</span>
            <span>{DATE_FORMATTER.format(new Date(project.updated_at))}</span>
          </div>
        </div>

        {error ? <MarbleAlert tone="error">{error}</MarbleAlert> : null}

        <MarbleCard>
          {project.tables.length === 0 ? (
            <MarbleCardContent>
              <MarbleEmptyState
                description="Create a table, then open it to start building."
                title="No tables in this project yet"
              />
            </MarbleCardContent>
          ) : (
            <MarbleCardContent className="p-0">
              {project.tables.map((table) => (
                <MarbleListRow
                  description={
                    <>
                      <span>
                        {DATE_FORMATTER.format(new Date(table.updated_at))}
                      </span>
                      <span className="font-mono">{table.id}</span>
                    </>
                  }
                  descriptionClassName="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500"
                  key={table.id}
                  onClick={() =>
                    router.push(`/projects/${project.id}/tables/${table.id}`)
                  }
                  title={table.name || "Untitled Table"}
                />
              ))}
            </MarbleCardContent>
          )}
        </MarbleCard>

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
