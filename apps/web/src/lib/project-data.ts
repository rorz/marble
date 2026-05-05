import "server-only";
import type { Database } from "@marble/supabase";
import {
  createServiceRoleClient,
  listOwnedProfileIds,
} from "./supabase/service-role";

type ProjectRow = Database["public"]["Tables"]["project"]["Row"];
type TableRow = Database["public"]["Tables"]["table"]["Row"];
type ColumnRow = Database["public"]["Tables"]["column"]["Row"];
type ProgramVersionRow = Database["public"]["Tables"]["program_version"]["Row"];

type TableInfo = TableRow & {
  project_folder_path: string[];
  project_name: string;
  project_owner_profile_id: string;
};

type ProjectInfo = ProjectRow & {
  table_count: number;
  tables: TableInfo[];
};

export type ReferenceableColumn = Pick<
  ColumnRow,
  "id" | "name" | "table_id"
> & {
  allow_manual_input: boolean;
  label: string;
  project_id: string;
  project_name: string;
  table_name: string;
};

function db() {
  return createServiceRoleClient();
}

function hasAllowManualInput(outputConfig: unknown) {
  if (!outputConfig || typeof outputConfig !== "object") {
    return false;
  }

  const flags = (
    outputConfig as {
      flags?: {
        allowManualInput?: boolean;
      };
    }
  ).flags;

  return flags?.allowManualInput === true;
}

function decorateTables(projects: ProjectRow[], tables: TableRow[]) {
  const projectById = new Map(
    projects.map((project) => [
      project.id,
      project,
    ]),
  );

  return tables.flatMap((table) => {
    const project = projectById.get(table.project_id);

    if (!project) {
      return [];
    }

    return [
      {
        ...table,
        project_folder_path: project.folder_path,
        project_name: project.name,
        project_owner_profile_id: project.owner_profile_id,
      } satisfies TableInfo,
    ];
  });
}

async function listOwnedProjectsAndTables(userId: string) {
  const ownedProfileIds = await listOwnedProfileIds(userId);

  if (ownedProfileIds.length === 0) {
    return {
      projects: [] as ProjectRow[],
      tables: [] as TableInfo[],
    };
  }

  const supabase = db();
  const { data: projectData, error: projectError } = await supabase
    .from("project")
    .select("*")
    .in("owner_profile_id", ownedProfileIds)
    .order("created_at");

  if (projectError) {
    throw projectError;
  }

  const projects = (projectData ?? []) as ProjectRow[];

  if (projects.length === 0) {
    return {
      projects,
      tables: [] as TableInfo[],
    };
  }

  const { data: tableData, error: tableError } = await supabase
    .from("table")
    .select("*")
    .in(
      "project_id",
      projects.map((project) => project.id),
    )
    .order("created_at");

  if (tableError) {
    throw tableError;
  }

  return {
    projects,
    tables: decorateTables(projects, (tableData ?? []) as TableRow[]),
  };
}

async function listOwnedTablesForUser(userId: string) {
  return (await listOwnedProjectsAndTables(userId)).tables;
}

export async function listProjectSummariesForUser(userId: string) {
  const { projects, tables } = await listOwnedProjectsAndTables(userId);
  const countsByProjectId = new Map<string, number>();

  for (const table of tables) {
    countsByProjectId.set(
      table.project_id,
      (countsByProjectId.get(table.project_id) ?? 0) + 1,
    );
  }

  return projects.map((project) => ({
    ...project,
    table_count: countsByProjectId.get(project.id) ?? 0,
  }));
}

export async function getOwnedProjectForUser(
  userId: string,
  projectId: string,
) {
  const { projects, tables } = await listOwnedProjectsAndTables(userId);
  const project = projects.find((candidate) => candidate.id === projectId);

  if (!project) {
    return null;
  }

  const projectTables = tables.filter(
    (table) => table.project_id === projectId,
  );

  return {
    ...project,
    table_count: projectTables.length,
    tables: projectTables,
  } satisfies ProjectInfo;
}

export async function getOwnedTableForUser(userId: string, tableId: string) {
  return (
    (await listOwnedTablesForUser(userId)).find(
      (table) => table.id === tableId,
    ) ?? null
  );
}

export async function listReferenceableColumnsForUser(userId: string) {
  const tables = await listOwnedTablesForUser(userId);

  if (tables.length === 0) {
    return [] as ReferenceableColumn[];
  }

  const supabase = db();
  const { data: columnData, error: columnError } = await supabase
    .from("column")
    .select("id, name, table_id, program_version_id")
    .in(
      "table_id",
      tables.map((table) => table.id),
    )
    .order("table_id")
    .order("idx");

  if (columnError) {
    throw columnError;
  }

  const columns = (columnData ?? []) as Array<
    Pick<ColumnRow, "id" | "name" | "table_id"> & {
      program_version_id: string;
    }
  >;
  const programVersionIds = Array.from(
    new Set(columns.map((column) => column.program_version_id)),
  );

  const { data: programVersionData, error: programVersionError } =
    programVersionIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("program_version")
          .select("id, output_config")
          .in("id", programVersionIds);

  if (programVersionError) {
    throw programVersionError;
  }

  const tableById = new Map(
    tables.map((table) => [
      table.id,
      table,
    ]),
  );
  const programVersionById = new Map(
    (
      (programVersionData ?? []) as Pick<
        ProgramVersionRow,
        "id" | "output_config"
      >[]
    ).map((programVersion) => [
      programVersion.id,
      programVersion,
    ]),
  );

  return columns.flatMap((column) => {
    const table = tableById.get(column.table_id);

    if (!table) {
      return [];
    }

    return [
      {
        allow_manual_input: hasAllowManualInput(
          programVersionById.get(column.program_version_id)?.output_config,
        ),
        id: column.id,
        label: `${table.project_name} / ${table.name} / ${column.name}`,
        name: column.name,
        project_id: table.project_id,
        project_name: table.project_name,
        table_id: table.id,
        table_name: table.name,
      } satisfies ReferenceableColumn,
    ];
  });
}
