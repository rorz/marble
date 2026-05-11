"use client";

import { toCamelKeys } from "@marble/lib/object";
import {
  MarbleAlert,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleConfirmModal,
  type MarbleConfirmModalState,
  MarbleContextPopover,
  MarbleEmptyState,
  MarbleListRow,
} from "@marble/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMarbleSdkFactory } from "../../../lib/marble-sdk-client";
import type { ProjectSummary } from "../../../lib/project-data";
import { usePrivateBroadcast } from "../../../lib/realtime/private-broadcast";
import {
  compareByUpdatedAtCamelDesc,
  getErrorMessage,
  removeRow,
  sortRows,
  upsertRow,
} from "../../../lib/realtime-crud";
import { isSidebarMutation } from "../../../lib/sidebar-sync";

type ProjectRecord = Omit<ProjectSummary, "tableCount">;
type TableRecord = {
  projectId: string;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function sortProjects(projects: ProjectSummary[]) {
  return sortRows(projects, compareByUpdatedAtCamelDesc);
}

function upsertProject(projects: ProjectSummary[], project: ProjectSummary) {
  return upsertRow(projects, project, compareByUpdatedAtCamelDesc);
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
          tableCount: Math.max(0, project.tableCount + delta),
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
  const [confirmState, setConfirmState] =
    useState<MarbleConfirmModalState | null>(null);

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
            const next = toCamelKeys(mutation.row) as ProjectRecord;

            if (!accessibleOwnerProfileIds.has(next.ownerProfileId)) {
              return removeRow(current, next.id);
            }

            const existing = current.find((project) => project.id === next.id);

            return upsertProject(current, {
              ...next,
              tableCount: existing?.tableCount ?? 0,
            });
          }

          case "table:delete":
            return mutation.row
              ? updateTableCount(
                  current,
                  (toCamelKeys(mutation.row) as TableRecord).projectId,
                  -1,
                )
              : current;

          case "table:upsert":
            return mutation.event === "INSERT"
              ? updateTableCount(
                  current,
                  (toCamelKeys(mutation.row) as TableRecord).projectId,
                  1,
                )
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
        createdAt: project.createdAt,
        folderPath: project.folderPath,
        id: project.id,
        name: project.name,
        ownerProfileId: project.ownerProfileId,
        tableCount: 0,
        updatedAt: project.updatedAt,
      };

      setProjects((current) => upsertProject(current, committedProject));
      router.push(`/projects/${project.id}`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setCreatePending(false);
    }
  };

  const handleDelete = (project: ProjectSummary) => {
    setConfirmState({
      confirmLabel: "Delete",
      message: `Delete ${project.name}? This also removes its tables and related data.`,
      onConfirm: () => {
        void performDelete(project);
      },
      title: "Delete project",
    });
  };

  const performDelete = async (project: ProjectSummary) => {
    setDeletingId(project.id);
    setError(null);

    try {
      await getSdk({
        profileId: project.ownerProfileId,
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
                        onSelect: () => handleDelete(project),
                        tone: "danger",
                      },
                    ]}
                  />
                }
                description={
                  <>
                    <span>{project.folderPath.join(" / ") || "Root"}</span>
                    <span>{project.tableCount} tables</span>
                    <span>
                      {DATE_FORMATTER.format(new Date(project.updatedAt))}
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

      <MarbleConfirmModal
        onClose={() => setConfirmState(null)}
        state={confirmState}
      />
    </div>
  );
}
