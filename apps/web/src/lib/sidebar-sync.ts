import type { Database } from "@marble/supabase";
import {
  createBroadcastMutationGuard,
  type DeleteMutation,
  type UpsertMutation,
} from "./realtime/broadcast-mutations";
import {
  buildPipeNode,
  buildProgramNode,
  buildProjectNode,
  buildSourceNode,
  buildTableNode,
  removeSidebarChildFromAll,
  removeSidebarNode,
  type SidebarTreeData,
  upsertSidebarChild,
  upsertSidebarNode,
} from "./sidebar-tree";

type PipeRow = Database["public"]["Tables"]["pipe"]["Row"];
type ProgramRow = Database["public"]["Tables"]["program"]["Row"];
type ProjectRow = Database["public"]["Tables"]["project"]["Row"];
type SourceRow = Database["public"]["Tables"]["source"]["Row"];
type TableRow = Database["public"]["Tables"]["table"]["Row"];

type SidebarMutation =
  | DeleteMutation<"program:delete", ProgramRow>
  | UpsertMutation<"program:upsert", ProgramRow>
  | DeleteMutation<"project:delete", ProjectRow>
  | UpsertMutation<"project:upsert", ProjectRow>
  | DeleteMutation<"table:delete", TableRow>
  | UpsertMutation<"table:upsert", TableRow>
  | DeleteMutation<"source:delete", SourceRow>
  | UpsertMutation<"source:upsert", SourceRow>
  | DeleteMutation<"pipe:delete", PipeRow>
  | UpsertMutation<"pipe:upsert", PipeRow>;

const sidebarMutationTypes = {
  "pipe:delete": true,
  "pipe:upsert": true,
  "program:delete": true,
  "program:upsert": true,
  "project:delete": true,
  "project:upsert": true,
  "source:delete": true,
  "source:upsert": true,
  "table:delete": true,
  "table:upsert": true,
} satisfies Record<SidebarMutation["type"], true>;

export const isSidebarMutation =
  createBroadcastMutationGuard<SidebarMutation>(sidebarMutationTypes);

function resolveProjectIdForPipe(current: SidebarTreeData, pipe: PipeRow) {
  for (const project of current.projects) {
    for (const child of project.children) {
      if (child.id === pipe.source_id || child.id === pipe.table_id) {
        return project.id;
      }
    }
  }

  return null;
}

export function applySidebarMutation(
  current: SidebarTreeData,
  mutation: SidebarMutation,
): SidebarTreeData {
  switch (mutation.type) {
    case "program:delete":
      return {
        ...current,
        programs: removeSidebarNode(current.programs, mutation.id),
      };

    case "program:upsert":
      if (
        !mutation.row.first_party &&
        !current.ownerProfileIds.includes(mutation.row.owner_profile_id)
      ) {
        return {
          ...current,
          programs: removeSidebarNode(current.programs, mutation.row.id),
        };
      }

      return {
        ...current,
        programs: upsertSidebarNode(
          current.programs,
          buildProgramNode(mutation.row),
        ),
      };

    case "project:delete":
      return {
        ...current,
        projects: removeSidebarNode(current.projects, mutation.id),
      };

    case "project:upsert": {
      if (!current.ownerProfileIds.includes(mutation.row.owner_profile_id)) {
        return {
          ...current,
          projects: removeSidebarNode(current.projects, mutation.row.id),
        };
      }

      const existing = current.projects.find(
        (project) => project.id === mutation.row.id,
      );

      return {
        ...current,
        projects: upsertSidebarNode(
          current.projects,
          buildProjectNode(mutation.row, existing?.children ?? []),
        ),
      };
    }

    case "table:delete":
      return {
        ...current,
        projects: removeSidebarChildFromAll(current.projects, mutation.id),
      };

    case "table:upsert": {
      const projects = removeSidebarChildFromAll(
        current.projects,
        mutation.row.id,
      );

      if (!projects.some((project) => project.id === mutation.row.project_id)) {
        return {
          ...current,
          projects,
        };
      }

      return {
        ...current,
        projects: upsertSidebarChild(
          projects,
          mutation.row.project_id,
          buildTableNode(mutation.row),
        ),
      };
    }

    case "source:delete":
      return {
        ...current,
        projects: removeSidebarChildFromAll(current.projects, mutation.id),
      };

    case "source:upsert": {
      const projects = removeSidebarChildFromAll(
        current.projects,
        mutation.row.id,
      );

      if (!projects.some((project) => project.id === mutation.row.project_id)) {
        return {
          ...current,
          projects,
        };
      }

      return {
        ...current,
        projects: upsertSidebarChild(
          projects,
          mutation.row.project_id,
          buildSourceNode(mutation.row),
        ),
      };
    }

    case "pipe:delete":
      return {
        ...current,
        projects: removeSidebarChildFromAll(current.projects, mutation.id),
      };

    case "pipe:upsert": {
      const projects = removeSidebarChildFromAll(
        current.projects,
        mutation.row.id,
      );
      const nextCurrent = {
        ...current,
        projects,
      };
      const projectId = resolveProjectIdForPipe(nextCurrent, mutation.row);
      const projectNode = projectId
        ? projects.find((project) => project.id === projectId)
        : null;

      if (!projectId) {
        return nextCurrent;
      }

      return {
        ...current,
        projects: upsertSidebarChild(
          projects,
          projectId,
          buildPipeNode(mutation.row, projectId, {
            sourceLabel:
              projectNode?.children.find(
                (child) => child.id === mutation.row.source_id,
              )?.label ?? "Untitled Source",
            tableLabel:
              projectNode?.children.find(
                (child) => child.id === mutation.row.table_id,
              )?.label ?? "Untitled Table",
          }),
        ),
      };
    }
  }
}
