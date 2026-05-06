import "server-only";

import { createServerMarbleSdk } from "./marble-sdk-server";
import {
  buildPipeNode,
  buildProgramNode,
  buildProjectNode,
  buildSourceNode,
  buildTableNode,
  type SidebarPipeRow,
  type SidebarSourceRow,
  type SidebarTableRow,
  type SidebarTreeData,
  sortSidebarNodes,
} from "./sidebar-tree";

export async function listSidebarDataForUser(
  _userId: string,
): Promise<SidebarTreeData> {
  const sdk = await createServerMarbleSdk();
  const data = await sdk.sidebar.getData({});
  const projects = data.projects;
  const projectIds = projects.map((project) => project.id);
  const projectIdSet = new Set(projectIds);
  const tables = data.tables.filter((table) =>
    projectIdSet.has(table.projectId),
  );
  const sources = data.sources.filter((source) =>
    projectIdSet.has(source.projectId),
  );
  const pipes = data.pipes;
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

  for (const pipe of pipes) {
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
    ownerProfileIds: data.ownerProfileIds,
    profiles: data.profiles,
    programs: sortSidebarNodes(data.programs.map(buildProgramNode)),
    projects: sortSidebarNodes(
      projects.map((project) =>
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
    userId: data.userId,
  };
}
