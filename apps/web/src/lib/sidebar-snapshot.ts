import {
  buildPipeNode,
  buildProgramNode,
  buildProjectNode,
  buildSourceNode,
  buildTableNode,
  type SidebarPipeRow,
  type SidebarProgramRow,
  type SidebarProjectRow,
  type SidebarSourceRow,
  type SidebarTableRow,
  type SidebarTreeData,
  sortSidebarNodes,
} from "./sidebar-tree";

type SidebarSnapshot = {
  ownerProfileIds: string[];
  pipes: SidebarPipeRow[];
  profiles: SidebarTreeData["profiles"];
  programs: SidebarProgramRow[];
  projects: SidebarProjectRow[];
  sources: SidebarSourceRow[];
  tables: SidebarTableRow[];
  userId: string;
};

export const buildSidebarTreeData = (
  snapshot: SidebarSnapshot,
): SidebarTreeData => {
  const projectIdSet = new Set(snapshot.projects.map((project) => project.id));
  const tables = snapshot.tables.filter((table) =>
    projectIdSet.has(table.projectId),
  );
  const sources = snapshot.sources.filter((source) =>
    projectIdSet.has(source.projectId),
  );
  const tablesByProjectId = new Map<string, SidebarTableRow[]>();
  const sourcesByProjectId = new Map<string, SidebarSourceRow[]>();
  const pipesByProjectId = new Map<string, SidebarPipeRow[]>();
  const sourceById = new Map(
    sources.map((source) => [
      source.id,
      source,
    ]),
  );
  const tableById = new Map(
    tables.map((table) => [
      table.id,
      table,
    ]),
  );

  for (const table of tables) {
    const siblings = tablesByProjectId.get(table.projectId) ?? [];
    siblings.push(table);
    tablesByProjectId.set(table.projectId, siblings);
  }

  for (const source of sources) {
    const siblings = sourcesByProjectId.get(source.projectId) ?? [];
    siblings.push(source);
    sourcesByProjectId.set(source.projectId, siblings);
  }

  for (const pipe of snapshot.pipes) {
    const projectId =
      sourceById.get(pipe.sourceId)?.projectId ??
      tableById.get(pipe.tableId)?.projectId;

    if (!projectId) {
      continue;
    }

    const siblings = pipesByProjectId.get(projectId) ?? [];
    siblings.push(pipe);
    pipesByProjectId.set(projectId, siblings);
  }

  return {
    ownerProfileIds: snapshot.ownerProfileIds,
    profiles: snapshot.profiles,
    programs: sortSidebarNodes(snapshot.programs.map(buildProgramNode)),
    projects: sortSidebarNodes(
      snapshot.projects.map((project) =>
        buildProjectNode(project, [
          ...(tablesByProjectId.get(project.id) ?? []).map(buildTableNode),
          ...(sourcesByProjectId.get(project.id) ?? []).map(buildSourceNode),
          ...(pipesByProjectId.get(project.id) ?? []).map((pipe) =>
            buildPipeNode(pipe, project.id, {
              sourceLabel:
                sourceById.get(pipe.sourceId)?.name ?? "Untitled Source",
              tableLabel: tableById.get(pipe.tableId)?.name ?? "Untitled Table",
            }),
          ),
        ]),
      ),
    ),
    userId: snapshot.userId,
  };
};
