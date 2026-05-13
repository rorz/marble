import type { ResourceDeps } from "../../db";
import { requireServiceSupabase, requireUserId } from "../require-deps";

export type SidebarData = {
  ownerProfileIds: string[];
  pipes: Array<{
    id: string;
    sourceId: string;
    tableId: string;
    updatedAt: string;
  }>;
  profiles: Array<{
    externalName: null | string;
    icon: null | string;
    id: string;
    name: string;
    type: "Agent" | "Human";
  }>;
  programs: Array<{
    firstParty: boolean;
    id: string;
    name: string;
    ownerProfileId: string;
    updatedAt: string;
  }>;
  projects: Array<{
    createdAt: string;
    folderPath: string[];
    id: string;
    name: string;
    ownerProfileId: string;
    updatedAt: string;
  }>;
  sources: Array<{
    id: string;
    name: string;
    projectId: string;
    updatedAt: string;
  }>;
  tables: Array<{
    id: string;
    name: string;
    projectId: string;
    updatedAt: string;
  }>;
  userId: string;
};

export class SidebarCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly getData = async (): Promise<SidebarData> => {
    const userId = requireUserId(this.deps, "Sidebar");
    const supabase = requireServiceSupabase(this.deps, "Sidebar");
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
      supabase
        .from("project")
        .select(
          "created_at, folder_path, id, name, owner_profile_id, updated_at",
        )
        .order("updated_at", {
          ascending: false,
        }),
      supabase
        .from("program")
        .select("first_party, id, name, owner_profile_id, updated_at")
        .eq("first_party", true),
      supabase
        .from("program")
        .select("first_party, id, name, owner_profile_id, updated_at"),
    ]);

    if (
      profilesResult.error ||
      projectsResult.error ||
      firstPartyProgramsResult.error ||
      ownedProgramsResult.error
    ) {
      throw new Error(
        profilesResult.error?.message ??
          projectsResult.error?.message ??
          firstPartyProgramsResult.error?.message ??
          ownedProgramsResult.error?.message ??
          "Could not load sidebar data.",
      );
    }

    const ownerProfileIds = (profilesResult.data ?? []).map(
      (profile) => profile.id,
    );
    const ownedProfileIdSet = new Set(ownerProfileIds);
    const projects = (projectsResult.data ?? []).filter((project) =>
      ownedProfileIdSet.has(project.owner_profile_id),
    );
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
        : supabase.from("pipe").select("id, source_id, table_id, updated_at"),
    ]);

    if (tablesResult.error || sourcesResult.error || pipesResult.error) {
      throw new Error(
        tablesResult.error?.message ??
          sourcesResult.error?.message ??
          pipesResult.error?.message ??
          "Could not load sidebar children.",
      );
    }

    const programs = new Map<
      string,
      NonNullable<typeof firstPartyProgramsResult.data>[number]
    >();

    for (const program of [
      ...(firstPartyProgramsResult.data ?? []),
      ...(ownedProgramsResult.data ?? []).filter((program) =>
        ownedProfileIdSet.has(program.owner_profile_id),
      ),
    ]) {
      programs.set(program.id, program);
    }

    return {
      ownerProfileIds,
      pipes: (pipesResult.data ?? []).map((pipe) => ({
        id: pipe.id,
        sourceId: pipe.source_id,
        tableId: pipe.table_id,
        updatedAt: pipe.updated_at,
      })),
      profiles: (profilesResult.data ?? []).map((profile) => ({
        externalName: profile.external_name,
        icon: profile.icon,
        id: profile.id,
        name: profile.name,
        type: profile.type,
      })),
      programs: [
        ...programs.values(),
      ].map((program) => ({
        firstParty: program.first_party,
        id: program.id,
        name: program.name,
        ownerProfileId: program.owner_profile_id,
        updatedAt: program.updated_at,
      })),
      projects: projects.map((project) => ({
        createdAt: project.created_at,
        folderPath: project.folder_path,
        id: project.id,
        name: project.name,
        ownerProfileId: project.owner_profile_id,
        updatedAt: project.updated_at,
      })),
      sources: (sourcesResult.data ?? []).map((source) => ({
        id: source.id,
        name: source.name,
        projectId: source.project_id,
        updatedAt: source.updated_at,
      })),
      tables: (tablesResult.data ?? []).map((table) => ({
        id: table.id,
        name: table.name,
        projectId: table.project_id,
        updatedAt: table.updated_at,
      })),
      userId,
    };
  };
}
