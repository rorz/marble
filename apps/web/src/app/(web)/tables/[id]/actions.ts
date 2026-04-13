"use server";

import type { Database } from "@marble/supabase";
import { env } from "@/env";
import { requireUser } from "../../../../lib/auth";
import { callMarbleApi } from "../../../../lib/marble-api";
import { createServiceRoleClient } from "../../../../lib/supabase/service-role";

type CellRow = Database["public"]["Tables"]["cell"]["Row"];
type ColumnRow = Database["public"]["Tables"]["column"]["Row"];
type DependencyRow = Database["public"]["Tables"]["column_dependency"]["Row"];
type ProgramRunRow = Database["public"]["Tables"]["program_run"]["Row"];
type RowRow = Database["public"]["Tables"]["row"]["Row"];

const SUPABASE_SELECT_PAGE_SIZE = 1000;

function db() {
  return createServiceRoleClient();
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

// ── Tables ──────────────────────────────────────────────

export async function listTables() {
  await requireUser();
  const { data, error } = await db()
    .from("table")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function createTable() {
  return callMarbleApi<Database["public"]["Tables"]["table"]["Row"]>(
    "/tables",
    {
      method: "POST",
    },
  );
}

export async function updateTableName(id: string, name: string) {
  return callMarbleApi<Database["public"]["Tables"]["table"]["Row"]>(
    `/tables/${id}`,
    {
      body: {
        name,
      },
      method: "PATCH",
    },
  );
}

// ── Programs ────────────────────────────────────────────

export async function listPrograms() {
  await requireUser();
  const { data, error } = await db()
    .from("program")
    .select("*, program_version!program_version_program_id_fkey(*)")
    .order("created_at");
  if (error) throw error;
  return data;
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
  await requireUser();
  const supabase = db();

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
      dependencies: [] as DependencyRow[],
      rows,
    };
  }

  const [cells, dependencies] = await Promise.all([
    selectAllPages<CellRow>((from, to) =>
      supabase
        .from("cell")
        .select("*")
        .in("column_id", columnIds)
        .order("row_id")
        .order("column_id")
        .range(from, to),
    ),
    selectAllPages<DependencyRow>((from, to) =>
      supabase
        .from("column_dependency")
        .select("*")
        .in("source_column_id", columnIds)
        .order("source_column_id")
        .order("target_column_id")
        .range(from, to),
    ),
  ]);

  return {
    cells,
    columns,
    dependencies,
    rows,
  };
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
  programId: string;
  cellId: string;
  cellValue?: string;
}): Promise<{
  success: boolean;
  output: unknown;
  runId: string;
}> {
  const requestId = crypto.randomUUID();

  await callMarbleApi<CellRow>(`/cells/${input.cellId}`, {
    body: {
      ...(input.cellValue === undefined
        ? {}
        : {
            manualInput: input.cellValue,
          }),
      state: {
        ok: null,
      },
    },
    method: "PATCH",
    requestId,
  });

  const run = await callMarbleApi<ProgramRunRow>("/program-runs", {
    body: {
      programVersionId: input.programId,
      targetCellId: input.cellId,
    },
    method: "POST",
    requestId,
  });
  const executorUrl = env.EXECUTOR_URL;

  let result: {
    error?: boolean;
    message?: string;
    output?: unknown;
    success?: boolean;
  };
  try {
    const response = await fetch(`${executorUrl}/run?run_id=${run.id}`, {
      body: "{}",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    result = (await response.json()) as typeof result;
  } catch (err) {
    throw new Error(
      `Could not reach executor at ${executorUrl} — is it running? (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  if (result.error) {
    throw new Error(result.message ?? "Executor returned an error");
  }

  return {
    output: result.output,
    runId: run.id,
    success: result.success ?? false,
  };
}
