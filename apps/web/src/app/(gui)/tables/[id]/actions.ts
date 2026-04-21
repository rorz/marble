"use server";

import type { Database } from "@marble/supabase";
import { revalidatePath } from "next/cache";
import { requireUser } from "../../../../lib/auth";
import { callMarbleApi } from "../../../../lib/marble-api";
import {
  getOwnedTableForUser,
  listReferenceableColumnsForUser,
} from "../../../../lib/project-data";
import {
  createServiceRoleClient,
  listOwnedProfileIds,
} from "../../../../lib/supabase/service-role";

type CellRow = Database["public"]["Tables"]["cell"]["Row"];
type ColumnRow = Database["public"]["Tables"]["column"]["Row"];
type DependencyRow = Database["public"]["Tables"]["column_dependency"]["Row"];
type ProgramRow = Database["public"]["Tables"]["program"]["Row"];
type ProgramVersionRow = Database["public"]["Tables"]["program_version"]["Row"];
type RowRow = Database["public"]["Tables"]["row"]["Row"];
type TableRow = Database["public"]["Tables"]["table"]["Row"];
type FullProgram = ProgramRow & {
  program_version: Pick<
    ProgramVersionRow,
    "id" | "input_schema" | "output_config" | "version"
  >[];
};
type RunExecutionResult = {
  output: unknown;
  runId: string;
  success: boolean;
};

const SUPABASE_SELECT_PAGE_SIZE = 1000;
const PROGRAM_SELECT =
  "*, program_version!program_version_program_id_fkey(id, version, input_schema, output_config)";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRowBatchResult(value: unknown): value is {
  cells: CellRow[];
  rows: RowRow[];
} {
  return (
    isRecord(value) && Array.isArray(value.rows) && Array.isArray(value.cells)
  );
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

async function loadColumn(columnId: string) {
  const { data, error } = await db()
    .from("column")
    .select("*, program_version(*, program!program_version_program_id_fkey(*))")
    .eq("id", columnId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTableName(id: string, name: string) {
  const table = await requireOwnedTable(id);
  const updated = await callMarbleApi<TableRow>(`/tables/${id}`, {
    body: {
      name: name.trim() || "Untitled Table",
    },
    method: "PATCH",
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${table.project_id}`);
  revalidatePath(`/projects/${table.project_id}/tables/${id}`);
  revalidatePath(`/tables/${id}`);

  return updated;
}

// ── Programs ────────────────────────────────────────────

export async function listProgramsForEditor(): Promise<FullProgram[]> {
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

export async function loadTableData(tableId: string) {
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
  const [table, data, programs, referenceColumns] = await Promise.all([
    requireOwnedTable(tableId),
    loadTableData(tableId),
    listProgramsForEditor(),
    listReferenceableColumns(),
  ]);

  return {
    ...data,
    programs,
    referenceColumns,
    table,
  };
}

export async function listReferenceableColumns() {
  const user = await requireUser();
  return listReferenceableColumnsForUser(user.id);
}

// ── Columns ─────────────────────────────────────────────

export async function createColumn(input: {
  table_id: string;
  name: string;
  program_id: string;
  input_template: string;
}) {
  const created = await callMarbleApi<
    ColumnRow & {
      cells: CellRow[];
      dependencies: DependencyRow[];
    }
  >("/columns", {
    body: {
      inputTemplate: input.input_template,
      name: input.name,
      programVersionId: input.program_id,
      tableId: input.table_id,
    },
    method: "POST",
  });

  return {
    cells: created.cells,
    column: await loadColumn(created.id),
    dependencies: created.dependencies,
  };
}

export async function updateColumn(input: {
  columnId: string;
  name?: string;
  program_id?: string;
  input_template?: string;
}) {
  await callMarbleApi(`/columns/${input.columnId}`, {
    body: {
      ...(input.input_template === undefined
        ? {}
        : {
            inputTemplate: input.input_template,
          }),
      ...(input.name === undefined
        ? {}
        : {
            name: input.name,
          }),
      ...(input.program_id === undefined
        ? {}
        : {
            programVersionId: input.program_id,
          }),
    },
    method: "PATCH",
  });

  return loadColumn(input.columnId);
}

export async function deleteColumn(columnId: string) {
  await callMarbleApi(`/columns/${columnId}`, {
    method: "DELETE",
  });
}

// ── Rows ────────────────────────────────────────────────

export async function createRows(tableId: string, count = 1) {
  const requestId = crypto.randomUUID();
  const created = await callMarbleApi<
    | RowRow
    | {
        cells: CellRow[];
        rows: RowRow[];
      }
  >(`/tables/${tableId}/rows`, {
    body: {
      count,
    },
    method: "POST",
    requestId,
  });

  if (isRowBatchResult(created)) {
    return created;
  }

  const cells = await callMarbleApi<CellRow[]>(`/rows/${created.id}/cells`, {
    requestId,
  });

  return {
    cells,
    rows: [
      created,
    ],
  };
}

export async function deleteRow(rowId: string) {
  await callMarbleApi(`/rows/${rowId}`, {
    method: "DELETE",
  });
}

// ── Cells ───────────────────────────────────────────────

export async function updateCellManualInput(cellId: string, value: string) {
  return callMarbleApi<CellRow>(`/cells/${cellId}`, {
    body: {
      manualInput: value,
    },
    method: "PATCH",
  });
}

// ── Execution ───────────────────────────────────────────

export async function executeRun(input: {
  cellId: string;
  cellValue?: string;
}): Promise<RunExecutionResult> {
  return callMarbleApi<RunExecutionResult>(`/cells/${input.cellId}/run`, {
    body: {
      ...(input.cellValue === undefined
        ? {}
        : {
            manualInput: input.cellValue,
          }),
    },
    method: "POST",
  });
}
