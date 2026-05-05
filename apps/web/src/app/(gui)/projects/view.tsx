"use client";

import type { Database } from "@marble/supabase";
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
import { useState } from "react";
import { useMarbleSdkFactory } from "../../../lib/marble-sdk-client";
import { usePrivateBroadcast } from "../../../lib/realtime/private-broadcast";
import {
  compareByUpdatedAtDesc,
  getErrorMessage,
  removeRow,
  sortRows,
  upsertRow,
} from "../../../lib/realtime-crud";
import { isSidebarMutation } from "../../../lib/sidebar-sync";

type ProjectRecord = Database["public"]["Tables"]["project"]["Row"];
type ProjectSummary = ProjectRecord & {
  table_count: number;
};

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
  userId,
}: {
  initialProjects: ProjectSummary[];
  ownerProfileIds: string[];
  userId: string;
}) {
  const router = useRouter();
  const getSdk = useMarbleSdkFactory();
  const [projects, setProjects] = useState(() => sortProjects(initialProjects));
  const [createPending, setCreatePending] = useState(false);
  const [deletingId, setDeletingId] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);

  const accessibleOwnerProfileIds = new Set(ownerProfileIds);

  usePrivateBroadcast({
    event: "sidebar_mutation",
    label: "Projects",
    onMessage: (mutation) => {
      if (!isSidebarMutation(mutation)) {
        return;
      }

      setProjects((current) => {
        switch (mutation.type) {
          case "project:delete":
            return removeRow(current, mutation.id);

          case "project:upsert": {
            const next = mutation.row;

            if (!accessibleOwnerProfileIds.has(next.owner_profile_id)) {
              return removeRow(current, next.id);
            }

            const existing = current.find((project) => project.id === next.id);

            return upsertProject(current, {
              ...next,
              table_count: existing?.table_count ?? 0,
            });
          }

          case "table:delete":
            return mutation.row
              ? updateTableCount(current, mutation.row.project_id, -1)
              : current;

          case "table:upsert":
            return mutation.event === "INSERT"
              ? updateTableCount(current, mutation.row.project_id, 1)
              : current;

          default:
            return current;
        }
      });
    },
    topic: `gui-sidebar:user:${userId}`,
  });

  const handleCreate = async (_formData: FormData) => {
    setCreatePending(true);
    setError(null);

    try {
      const project = await getSdk().projects.create({});
      const committedProject = {
        created_at: project.createdAt,
        folder_path: project.folderPath,
        id: project.id,
        name: project.name,
        owner_profile_id: project.ownerProfileId,
        table_count: 0,
        updated_at: project.updatedAt,
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
      await getSdk({
        profileId: project.owner_profile_id,
      }).projects.delete({
        projectId: project.id,
      });
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
