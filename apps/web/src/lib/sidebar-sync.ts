import { castCamelKeys } from "@marble/lib/object";
import { buildPipeTitle } from "./pipe-display";
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
  type SidebarTreeNode,
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

const resolveProjectIdForPipe = (
  current: SidebarTreeData,
  pipe: SidebarPipeRow,
) => {
  for (const project of current.projects) {
    for (const child of project.children) {
      if (child.id === pipe.sourceId || child.id === pipe.tableId) {
        return project.id;
      }
    }
  }

  return null;
};

const findSidebarChildById = (
  projects: SidebarTreeNode[],
  childId: string,
): null | SidebarTreeNode => {
  for (const project of projects) {
    const match = project.children.find((child) => child.id === childId);

    if (match) {
      return match;
    }
  }

  return null;
};

const isStaleUpsert = (
  existing: null | SidebarTreeNode | undefined,
  incomingUpdatedAt: string,
): boolean => {
  if (!existing) {
    return false;
  }

  return (
    new Date(existing.updatedAt).getTime() >
    new Date(incomingUpdatedAt).getTime()
  );
};

const upsertProjectChildMutation = <
  Row extends {
    id: string;
    projectId: string;
    updatedAt: string;
  },
>(
  current: SidebarTreeData,
  row: Row,
  buildNode: (row: Row) => ReturnType<typeof buildTableNode>,
): SidebarTreeData => {
  if (
    isStaleUpsert(findSidebarChildById(current.projects, row.id), row.updatedAt)
  ) {
    return current;
  }

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
};

const applyMutationToTree = (
  current: SidebarTreeData,
  mutation: SidebarMutation,
): SidebarTreeData => {
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

      const existing = current.programs.find((node) => node.id === program.id);

      if (isStaleUpsert(existing, program.updatedAt)) {
        return current;
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

      if (isStaleUpsert(existing, project.updatedAt)) {
        return current;
      }

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

      if (
        isStaleUpsert(
          findSidebarChildById(current.projects, pipe.id),
          pipe.updatedAt,
        )
      ) {
        return current;
      }

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
};

// Generic re-derivation pass. Walks each project's children; for every node
// whose `label` is a function of sibling state (currently: pipes, whose label
// is built from their referenced source + table labels), recomputes the label
// from current sibling state and replaces the node if it drifted. Returns the
// same reference when nothing changed so React reference-equality stays cheap.
// Call after every mutation that could alter a sibling whose label feeds a
// derived node — running it unconditionally is fine; it's idempotent and O(n).
const recomputeDerivedLabels = (tree: SidebarTreeData): SidebarTreeData => {
  let anyProjectChanged = false;
  const projects = tree.projects.map((project) => {
    let anyChildChanged = false;
    const labelById = new Map<string, string>();
    for (const child of project.children) {
      labelById.set(child.id, child.label);
    }
    const children = project.children.map((child) => {
      if (child.kind !== "pipe") {
        return child;
      }
      const sourceLabel = child.sourceId
        ? (labelById.get(child.sourceId) ?? null)
        : null;
      const tableLabel = child.tableId
        ? (labelById.get(child.tableId) ?? null)
        : null;
      const nextLabel = buildPipeTitle({
        sourceLabel,
        tableLabel,
      });
      if (nextLabel === child.label) {
        return child;
      }
      anyChildChanged = true;
      return {
        ...child,
        label: nextLabel,
      };
    });
    if (!anyChildChanged) {
      return project;
    }
    anyProjectChanged = true;
    return {
      ...project,
      children,
    };
  });
  if (!anyProjectChanged) {
    return tree;
  }
  return {
    ...tree,
    projects,
  };
};

export const applySidebarMutation = (
  current: SidebarTreeData,
  mutation: SidebarMutation,
): SidebarTreeData => {
  return recomputeDerivedLabels(applyMutationToTree(current, mutation));
};
