import "server-only";

import {
  buildPipeNode,
  buildProgramNode,
  buildProjectNode,
  buildSourceNode,
  buildTableNode,
  type SidebarPipeRow,
  type SidebarProfileRecord,
  type SidebarProgramRow,
  type SidebarProjectRow,
  type SidebarSourceRow,
  type SidebarTableRow,
  type SidebarTreeData,
  sortSidebarNodes,
} from "./sidebar-tree";
import {
  createServiceRoleClient,
  listOwnedProfileIds,
} from "./supabase/service-role";

export async function listSidebarDataForUser(
  userId: string,
): Promise<SidebarTreeData> {
  const ownerProfileIds = await listOwnedProfileIds(userId);
  const supabase = createServiceRoleClient();

  const [
    profilesResult,
    projectsResult,
    firstPartyProgramsResult,
    ownedProgramsResult,
  ] = await Promise.all([
    supabase
      .from("profile")
      .select("id, name, external_name, icon, type")
      .eq("owner_user_id", userId)
      .order("created_at", {
        ascending: true,
      }),
    ownerProfileIds.length === 0
      ? Promise.resolve({
          data: [],
          error: null,
        })
      : supabase
          .from("project")
          .select("id, name, owner_profile_id, updated_at")
          .in("owner_profile_id", ownerProfileIds),
    supabase
      .from("program")
      .select("first_party, id, name, owner_profile_id, updated_at")
      .eq("first_party", true),
    ownerProfileIds.length === 0
      ? Promise.resolve({
          data: [],
          error: null,
        })
      : supabase
          .from("program")
          .select("first_party, id, name, owner_profile_id, updated_at")
          .in("owner_profile_id", ownerProfileIds),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (projectsResult.error) {
    throw projectsResult.error;
  }

  if (firstPartyProgramsResult.error) {
    throw firstPartyProgramsResult.error;
  }

  if (ownedProgramsResult.error) {
    throw ownedProgramsResult.error;
  }

  const projects = (projectsResult.data ?? []) as SidebarProjectRow[];
  const projectIds = projects.map((project) => project.id);
  const [tablesResult, sourcesResult, pipesResult] = await Promise.all([
    projectIds.length === 0
      ? Promise.resolve({
          data: [],
          error: null,
        })
      : supabase
          .from("table")
          .select("id, name, project_id, updated_at")
          .in("project_id", projectIds),
    projectIds.length === 0
      ? Promise.resolve({
          data: [],
          error: null,
        })
      : supabase
          .from("source")
          .select("id, name, project_id, updated_at")
          .in("project_id", projectIds),
    projectIds.length === 0
      ? Promise.resolve({
          data: [],
          error: null,
        })
      : supabase
          .from("pipe")
          .select("id, name, source_id, table_id, updated_at"),
  ]);

  if (tablesResult.error) {
    throw tablesResult.error;
  }

  if (sourcesResult.error) {
    throw sourcesResult.error;
  }

  if (pipesResult.error) {
    throw pipesResult.error;
  }

  const tables = (tablesResult.data ?? []) as SidebarTableRow[];
  const sources = (sourcesResult.data ?? []) as SidebarSourceRow[];
  const pipes = (pipesResult.data ?? []) as SidebarPipeRow[];
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
    const siblings = tablesByProjectId.get(table.project_id) ?? [];
    siblings.push(table);
    tablesByProjectId.set(table.project_id, siblings);
  }

  for (const source of sources) {
    const siblings = sourcesByProjectId.get(source.project_id) ?? [];
    siblings.push(source);
    sourcesByProjectId.set(source.project_id, siblings);
  }

  for (const pipe of pipes) {
    const projectId =
      sourceById.get(pipe.source_id)?.project_id ??
      tableById.get(pipe.table_id)?.project_id;

    if (!projectId) {
      continue;
    }

    const siblings = pipesByProjectId.get(projectId) ?? [];
    siblings.push(pipe);
    pipesByProjectId.set(projectId, siblings);
  }

  const programs = new Map<string, SidebarProgramRow>();

  for (const program of [
    ...((firstPartyProgramsResult.data ?? []) as SidebarProgramRow[]),
    ...((ownedProgramsResult.data ?? []) as SidebarProgramRow[]),
  ]) {
    programs.set(program.id, program);
  }

  return {
    ownerProfileIds,
    profiles: (profilesResult.data ?? []) as SidebarProfileRecord[],
    programs: sortSidebarNodes(
      [
        ...programs.values(),
      ].map(buildProgramNode),
    ),
    projects: sortSidebarNodes(
      projects.map((project) =>
        buildProjectNode(project, [
          ...(tablesByProjectId.get(project.id) ?? []).map(buildTableNode),
          ...(sourcesByProjectId.get(project.id) ?? []).map(buildSourceNode),
          ...(pipesByProjectId.get(project.id) ?? []).map((pipe) =>
            buildPipeNode(pipe, project.id),
          ),
        ]),
      ),
    ),
  };
}
