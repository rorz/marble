import type { Database } from "@marble/supabase";
import {
  buildDrainNode,
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

type DrainRow = Database["public"]["Tables"]["drain"]["Row"];
type ProgramRow = Database["public"]["Tables"]["program"]["Row"];
type ProjectRow = Database["public"]["Tables"]["project"]["Row"];
type SourceRow = Database["public"]["Tables"]["source"]["Row"];
type TableRow = Database["public"]["Tables"]["table"]["Row"];

export type SidebarMutation =
  | {
      id: string;
      type: "program:delete";
    }
  | {
      row: ProgramRow;
      type: "program:upsert";
    }
  | {
      id: string;
      type: "project:delete";
    }
  | {
      row: ProjectRow;
      type: "project:upsert";
    }
  | {
      id: string;
      type: "table:delete";
    }
  | {
      row: TableRow;
      type: "table:upsert";
    }
  | {
      id: string;
      type: "source:delete";
    }
  | {
      row: SourceRow;
      type: "source:upsert";
    }
  | {
      id: string;
      type: "drain:delete";
    }
  | {
      row: DrainRow;
      type: "drain:upsert";
    };

function resolveProjectIdForDrain(current: SidebarTreeData, drain: DrainRow) {
  for (const project of current.projects) {
    for (const child of project.children) {
      if (child.id === drain.source_id || child.id === drain.table_id) {
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

    case "drain:delete":
      return {
        ...current,
        projects: removeSidebarChildFromAll(current.projects, mutation.id),
      };

    case "drain:upsert": {
      const projects = removeSidebarChildFromAll(
        current.projects,
        mutation.row.id,
      );
      const nextCurrent = {
        ...current,
        projects,
      };
      const projectId = resolveProjectIdForDrain(nextCurrent, mutation.row);

      if (!projectId) {
        return nextCurrent;
      }

      return {
        ...current,
        projects: upsertSidebarChild(
          projects,
          projectId,
          buildDrainNode(mutation.row, projectId),
        ),
      };
    }
  }
}
