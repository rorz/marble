"use client";

import {
  MarbleAlert,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleContextPopover,
  MarbleEmptyState,
  MarbleListRow,
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
} from "../../../lib/realtime-crud";
import { createClient } from "../../../lib/supabase/browser";
import { createProjectAction, deleteProjectAction } from "./actions";

type ProjectRecord = Awaited<ReturnType<typeof createProjectAction>>;
type ProjectSummary = Awaited<
  ReturnType<typeof import("./actions").listProjects>
>[number];
type TableRecord = Awaited<
  ReturnType<typeof import("./actions").createTableAction>
>;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function sortProjects(projects: ProjectSummary[]) {
  return sortRows(projects, compareByUpdatedAtDesc);
}

function upsertProject(projects: ProjectSummary[], project: ProjectSummary) {
  return upsertRow(projects, project, compareByUpdatedAtDesc);
}

function updateTableCount(
  projects: ProjectSummary[],
  projectId: string,
  delta: number,
) {
  return projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          table_count: Math.max(0, project.table_count + delta),
        }
      : project,
  );
}

export function ProjectsPageView({
  initialProjects,
  ownerProfileIds,
}: {
  initialProjects: ProjectSummary[];
  ownerProfileIds: string[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(() => sortProjects(initialProjects));
  const [createPending, setCreatePending] = useState(false);
  const [deletingId, setDeletingId] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    const accessibleOwnerProfileIds = new Set(ownerProfileIds);
    const supabase = createClient();
    const projectChannel = supabase
      .channel("projects:list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project",
        },
        (payload) => {
          const change = payload as RealtimePayload<ProjectRecord>;

          setProjects((current) => {
            if (change.eventType === "DELETE") {
              return typeof change.old.id === "string"
                ? removeRow(current, change.old.id)
                : current;
            }

            const next = change.new as ProjectRecord;

            if (!accessibleOwnerProfileIds.has(next.owner_profile_id)) {
              return current;
            }

            const existing = current.find((project) => project.id === next.id);

            return upsertProject(current, {
              ...next,
              table_count: existing?.table_count ?? 0,
            });
          });
        },
      )
      .subscribe();

    const tableChannel = supabase
      .channel("projects:list:tables")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table",
        },
        (payload) => {
          const change = payload as RealtimePayload<TableRecord>;

          setProjects((current) => {
            if (
              change.eventType === "INSERT" &&
              typeof change.new.project_id === "string"
            ) {
              return updateTableCount(current, change.new.project_id, 1);
            }

            if (
              change.eventType === "DELETE" &&
              typeof change.old.project_id === "string"
            ) {
              return updateTableCount(current, change.old.project_id, -1);
            }

            if (
              change.eventType === "UPDATE" &&
              typeof change.new.project_id === "string" &&
              typeof change.old.project_id === "string" &&
              change.new.project_id !== change.old.project_id
            ) {
              return updateTableCount(
                updateTableCount(current, change.old.project_id, -1),
                change.new.project_id,
                1,
              );
            }

            return current;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(projectChannel);
      void supabase.removeChannel(tableChannel);
    };
  }, [
    ownerProfileIds,
  ]);

  const handleCreate = async (_formData: FormData) => {
    setCreatePending(true);
    setError(null);

    try {
      const project = await createProjectAction();
      const committedProject = {
        ...project,
        table_count: 0,
      };

      setProjects((current) => upsertProject(current, committedProject));
      router.push(`/projects/${project.id}`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setCreatePending(false);
    }
  };

  const handleDelete = async (project: ProjectSummary) => {
    if (
      !window.confirm(
        `Delete ${project.name}? This also removes its tables and related data.`,
      )
    ) {
      return;
    }

    setDeletingId(project.id);
    setError(null);

    try {
      await deleteProjectAction(project.id);
      setProjects((current) => removeRow(current, project.id));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <form
        action={handleCreate}
        className="flex items-center justify-end"
      >
        <MarbleButton
          disabled={createPending}
          type="submit"
          variant="orange"
        >
          {createPending ? "Creating" : "New project"}
        </MarbleButton>
      </form>

      {error ? <MarbleAlert tone="error">{error}</MarbleAlert> : null}

      <MarbleCard>
        {projects.length === 0 ? (
          <MarbleCardContent>
            <MarbleEmptyState
              description="Create an untitled project, then rename it from the project page."
              title="No projects yet"
            />
          </MarbleCardContent>
        ) : (
          <MarbleCardContent className="p-0">
            {projects.map((project) => (
              <MarbleListRow
                aside={
                  <MarbleContextPopover
                    align="end"
                    disabled={deletingId === project.id}
                    items={[
                      {
                        label:
                          deletingId === project.id ? "Deleting..." : "Delete",
                        onSelect: () => void handleDelete(project),
                        tone: "danger",
                      },
                    ]}
                  />
                }
                description={
                  <>
                    <span>{project.folder_path.join(" / ") || "Root"}</span>
                    <span>{project.table_count} tables</span>
                    <span>
                      {DATE_FORMATTER.format(new Date(project.updated_at))}
                    </span>
                  </>
                }
                descriptionClassName="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500"
                disabled={false}
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                title={project.name}
              />
            ))}
          </MarbleCardContent>
        )}
      </MarbleCard>
    </div>
  );
}
