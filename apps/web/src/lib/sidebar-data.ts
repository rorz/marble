import "server-only";

import {
  buildProgramNode,
  buildProjectNode,
  buildTableNode,
  type SidebarProfileRecord,
  type SidebarProgramRow,
  type SidebarProjectRow,
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
  const { data: tablesData, error: tablesError } =
    projectIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("table")
          .select("id, name, project_id, updated_at")
          .in("project_id", projectIds);

  if (tablesError) {
    throw tablesError;
  }

  const tablesByProjectId = new Map<string, SidebarTableRow[]>();

  for (const table of (tablesData ?? []) as SidebarTableRow[]) {
    const siblings = tablesByProjectId.get(table.project_id) ?? [];
    siblings.push(table);
    tablesByProjectId.set(table.project_id, siblings);
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
        buildProjectNode(
          project,
          (tablesByProjectId.get(project.id) ?? []).map(buildTableNode),
        ),
      ),
    ),
  };
}
