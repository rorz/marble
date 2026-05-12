import { castCamelKeys } from "@marble/lib/object";
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
  type SidebarPipeRow,
  type SidebarProgramRow,
  type SidebarProjectRow,
  type SidebarSourceRow,
  type SidebarTableRow,
  type SidebarTreeData,
  upsertSidebarChild,
  upsertSidebarNode,
} from "./sidebar-tree";

type SidebarMutation =
  | DeleteMutation<"program:delete", Record<string, unknown>>
  | UpsertMutation<"program:upsert", Record<string, unknown>>
  | DeleteMutation<"project:delete", Record<string, unknown>>
  | UpsertMutation<"project:upsert", Record<string, unknown>>
  | DeleteMutation<"table:delete", Record<string, unknown>>
  | UpsertMutation<"table:upsert", Record<string, unknown>>
  | DeleteMutation<"source:delete", Record<string, unknown>>
  | UpsertMutation<"source:upsert", Record<string, unknown>>
  | DeleteMutation<"pipe:delete", Record<string, unknown>>
  | UpsertMutation<"pipe:upsert", Record<string, unknown>>;

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

function resolveProjectIdForPipe(
  current: SidebarTreeData,
  pipe: SidebarPipeRow,
) {
  for (const project of current.projects) {
    for (const child of project.children) {
      if (child.id === pipe.sourceId || child.id === pipe.tableId) {
        return project.id;
      }
    }
  }

  return null;
}

function upsertProjectChildMutation<
  Row extends {
    id: string;
    projectId: string;
  },
>(
  current: SidebarTreeData,
  row: Row,
  buildNode: (row: Row) => ReturnType<typeof buildTableNode>,
): SidebarTreeData {
  const projects = removeSidebarChildFromAll(current.projects, row.id);

  if (!projects.some((project) => project.id === row.projectId)) {
    return {
      ...current,
      projects,
    };
  }

  return {
    ...current,
    projects: upsertSidebarChild(projects, row.projectId, buildNode(row)),
  };
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

    case "program:upsert": {
      const program = castCamelKeys<SidebarProgramRow>(mutation.row);

      if (
        !program.firstParty &&
        !current.ownerProfileIds.includes(program.ownerProfileId)
      ) {
        return {
          ...current,
          programs: removeSidebarNode(current.programs, program.id),
        };
      }

      return {
        ...current,
        programs: upsertSidebarNode(
          current.programs,
          buildProgramNode(program),
        ),
      };
    }

    case "project:delete":
      return {
        ...current,
        projects: removeSidebarNode(current.projects, mutation.id),
      };

    case "project:upsert": {
      const project = castCamelKeys<SidebarProjectRow>(mutation.row);

      if (!current.ownerProfileIds.includes(project.ownerProfileId)) {
        return {
          ...current,
          projects: removeSidebarNode(current.projects, project.id),
        };
      }

      const existing = current.projects.find(
        (currentProject) => currentProject.id === project.id,
      );

      return {
        ...current,
        projects: upsertSidebarNode(
          current.projects,
          buildProjectNode(project, existing?.children ?? []),
        ),
      };
    }

    case "table:delete":
    case "source:delete":
    case "pipe:delete":
      return {
        ...current,
        projects: removeSidebarChildFromAll(current.projects, mutation.id),
      };

    case "table:upsert":
      return upsertProjectChildMutation(
        current,
        castCamelKeys<SidebarTableRow>(mutation.row),
        buildTableNode,
      );

    case "source:upsert":
      return upsertProjectChildMutation(
        current,
        castCamelKeys<SidebarSourceRow>(mutation.row),
        buildSourceNode,
      );

    case "pipe:upsert": {
      const pipe = castCamelKeys<SidebarPipeRow>(mutation.row);
      const projects = removeSidebarChildFromAll(current.projects, pipe.id);
      const nextCurrent = {
        ...current,
        projects,
      };
      const projectId = resolveProjectIdForPipe(nextCurrent, pipe);
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
          buildPipeNode(pipe, projectId, {
            sourceLabel:
              projectNode?.children.find((child) => child.id === pipe.sourceId)
                ?.label ?? "Untitled Source",
            tableLabel:
              projectNode?.children.find((child) => child.id === pipe.tableId)
                ?.label ?? "Untitled Table",
          }),
        ),
      };
    }
  }
}
