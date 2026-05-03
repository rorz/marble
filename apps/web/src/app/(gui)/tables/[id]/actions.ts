"use server";

import type { Database } from "@marble/supabase";
import { requireUser } from "../../../../lib/auth";
import { callMarbleApi } from "../../../../lib/marble-api";
import {
  getOwnedTableForUser,
  listReferenceableColumnsForUser,
} from "../../../../lib/project-data";
import {
  listColumnSecretBindings,
  listLatestProgramSecretDeclarationsByProgramId,
  listProgramSecretBindingsForUser,
  listSecretsForUser,
} from "../../../../lib/secret-data";
import {
  createServiceRoleClient,
  listOwnedProfileIds,
} from "../../../../lib/supabase/service-role";

type CellRow = Database["public"]["Tables"]["cell"]["Row"];
type ProgramRow = Database["public"]["Tables"]["program"]["Row"];
type ProgramFileRow = Database["public"]["Tables"]["program_file"]["Row"];
type ProgramVersionRow = Database["public"]["Tables"]["program_version"]["Row"];
type RowRow = Database["public"]["Tables"]["row"]["Row"];
type FullProgram = ProgramRow & {
  program_version: (Pick<
    ProgramVersionRow,
    "id" | "input_schema" | "output_config" | "secret_config" | "version"
  > & {
    program_file: Pick<ProgramFileRow, "content" | "filename" | "filetype">[];
  })[];
};

const SUPABASE_SELECT_PAGE_SIZE = 1000;
const PROGRAM_SELECT =
  "*, program_version!program_version_program_id_fkey(id, version, input_schema, output_config, secret_config, program_file(*))";

function db() {
  return createServiceRoleClient();
}

async function requireOwnedTable(tableId: string) {
  const user = await requireUser();
  const table = await getOwnedTableForUser(user.id, tableId);

  if (!table) {
    throw new Error("Table not found");
  }

  return table;
}

async function listCurrentUserOwnedProfileIds() {
  const user = await requireUser();
  return listOwnedProfileIds(user.id);
}

async function selectAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
): Promise<T[]> {
  const records: T[] = [];

  for (let from = 0; ; from += SUPABASE_SELECT_PAGE_SIZE) {
    const to = from + SUPABASE_SELECT_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const page = data ?? [];
    records.push(...page);

    if (page.length < SUPABASE_SELECT_PAGE_SIZE) {
      return records;
    }
  }
}

// ── Programs ────────────────────────────────────────────

async function listProgramsForEditor(): Promise<FullProgram[]> {
  const ownedProfileIds = await listCurrentUserOwnedProfileIds();
  const supabase = db();

  const [firstPartyResult, ownedResult] = await Promise.all([
    supabase.from("program").select(PROGRAM_SELECT).eq("first_party", true),
    ownedProfileIds.length === 0
      ? Promise.resolve({
          data: [],
          error: null,
        })
      : supabase
          .from("program")
          .select(PROGRAM_SELECT)
          .in("owner_profile_id", ownedProfileIds),
  ]);

  if (firstPartyResult.error) {
    throw firstPartyResult.error;
  }

  if (ownedResult.error) {
    throw ownedResult.error;
  }

  const merged = new Map<string, FullProgram>();

  for (const program of [
    ...(firstPartyResult.data ?? []),
    ...(ownedResult.data ?? []),
  ]) {
    merged.set(program.id, program as FullProgram);
  }

  return [
    ...merged.values(),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function updateProgramOutputSchema(
  programVersionId: string,
  outputConfig: unknown,
) {
  await callMarbleApi(`/program-versions/${programVersionId}`, {
    body: {
      outputConfig,
    },
    method: "PATCH",
  });
}

// ── Table data (columns + rows + cells) ─────────────────

async function loadTableData(tableId: string) {
  const user = await requireUser();
  const supabase = db();

  if (!(await getOwnedTableForUser(user.id, tableId))) {
    throw new Error("Table not found");
  }

  const [cols, rows] = await Promise.all([
    supabase
      .from("column")
      .select(
        "*, program_version(*, program!program_version_program_id_fkey(*))",
      )
      .eq("table_id", tableId)
      .order("idx"),
    selectAllPages<RowRow>((from, to) =>
      supabase
        .from("row")
        .select("*")
        .eq("table_id", tableId)
        .order("idx")
        .range(from, to),
    ),
  ]);

  if (cols.error) throw cols.error;

  const columns = cols.data ?? [];
  const columnIds = columns.map((column) => column.id);

  if (columnIds.length === 0) {
    return {
      cells: [] as CellRow[],
      columns,
      rows,
    };
  }

  const cells = await selectAllPages<CellRow>((from, to) =>
    supabase
      .from("cell")
      .select("*")
      .in("column_id", columnIds)
      .order("row_id")
      .order("column_id")
      .range(from, to),
  );

  return {
    cells,
    columns,
    rows,
  };
}

export async function loadTablePageData(tableId: string) {
  const user = await requireUser();
  const [table, data, programs, referenceColumns] = await Promise.all([
    requireOwnedTable(tableId),
    loadTableData(tableId),
    listProgramsForEditor(),
    listReferenceableColumns(),
  ]);
  const [secrets, programSecretBindings, columnSecretBindings] =
    await Promise.all([
      listSecretsForUser(user.id),
      listProgramSecretBindingsForUser(
        user.id,
        programs.map((program) => program.id),
      ),
      listColumnSecretBindings(data.columns.map((column) => column.id)),
    ]);

  return {
    ...data,
    columnSecretBindings,
    programSecretBindings,
    programSecretDeclarations:
      listLatestProgramSecretDeclarationsByProgramId(programs),
    programs,
    referenceColumns,
    secrets,
    table,
  };
}

export async function listReferenceableColumns() {
  const user = await requireUser();
  return listReferenceableColumnsForUser(user.id);
}
