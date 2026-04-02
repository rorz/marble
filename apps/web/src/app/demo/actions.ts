"use server";

import type { Database, Json } from "@marble/supabase";
import { createClient } from "@marble/supabase";

type CellRow = Database["public"]["Tables"]["cell"]["Row"];

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

// ── Tables ──────────────────────────────────────────────

export async function listTables() {
  const { data, error } = await db()
    .from("table")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function createTable() {
  const { data, error } = await db().from("table").insert({}).select().single();
  if (error) throw error;
  return data;
}

// ── Table data (columns + rows + cells) ─────────────────

export async function loadTableData(tableId: string) {
  const supabase = db();

  const [cols, rowsRes] = await Promise.all([
    supabase
      .from("column")
      .select("*, column_program(*)")
      .eq("table_id", tableId)
      .order("index"),
    supabase.from("row").select("*").eq("table_id", tableId).order("index"),
  ]);

  if (cols.error) throw cols.error;
  if (rowsRes.error) throw rowsRes.error;

  const columnIds = cols.data.map((c) => c.id);

  if (columnIds.length === 0) {
    return {
      columns: cols.data,
      rows: rowsRes.data,
      cells: [] as CellRow[],
      dependencies:
        [] as Database["public"]["Tables"]["column_dependency"]["Row"][],
    };
  }

  const [cellsRes, depsRes] = await Promise.all([
    supabase.from("cell").select("*").in("column_id", columnIds),
    supabase
      .from("column_dependency")
      .select("*")
      .in("source_column_id", columnIds),
  ]);
  if (cellsRes.error) throw cellsRes.error;
  if (depsRes.error) throw depsRes.error;

  return {
    columns: cols.data,
    rows: rowsRes.data,
    cells: cellsRes.data,
    dependencies: depsRes.data,
  };
}

// ── Programs ────────────────────────────────────────────

export async function listPrograms() {
  const { data, error } = await db()
    .from("column_program")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function createProgram(input: {
  code: string;
  runtime: "JavaScript" | "Python";
  external_instance_type:
    | "Lite"
    | "Basic"
    | "Standard1"
    | "Standard2"
    | "Standard3"
    | "Standard4";
  input_schema: Json;
  output_schema: Json;
  first_party?: boolean;
}) {
  const { data, error } = await db()
    .from("column_program")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProgram(
  id: string,
  input: {
    code?: string;
    runtime?: "JavaScript" | "Python";
    external_instance_type?:
      | "Lite"
      | "Basic"
      | "Standard1"
      | "Standard2"
      | "Standard3"
      | "Standard4";
    input_schema?: Json;
    output_schema?: Json;
  },
) {
  const { data, error } = await db()
    .from("column_program")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProgram(id: string) {
  const { error } = await db().from("column_program").delete().eq("id", id);
  if (error) throw error;
}

// ── Columns ─────────────────────────────────────────────

export async function createColumn(input: {
  table_id: string;
  program_id: string;
  input_values_template: Json;
}) {
  const supabase = db();

  const { data: maxRow } = await supabase
    .from("column")
    .select("index")
    .eq("table_id", input.table_id)
    .order("index", {
      ascending: false,
    })
    .limit(1)
    .single();
  const nextIndex = (maxRow?.index ?? -1) + 1;

  const { data: column, error } = await supabase
    .from("column")
    .insert({
      ...input,
      index: nextIndex,
    })
    .select("*, column_program(*)")
    .single();
  if (error) throw error;

  // Auto-create column_dependency records from the template
  const template = input.input_values_template as {
    variables?: Record<
      string,
      {
        source: string;
        column_id?: string;
      }
    >;
  };
  const sourceColumnIds = Object.values(template.variables ?? {})
    .filter((v) => v.source === "column" && v.column_id)
    .map((v) => v.column_id as string);

  let newDeps: Database["public"]["Tables"]["column_dependency"]["Row"][] = [];
  if (sourceColumnIds.length > 0) {
    const { data: deps } = await supabase
      .from("column_dependency")
      .insert(
        sourceColumnIds.map((srcId) => ({
          source_column_id: srcId,
          target_column_id: column.id,
        })),
      )
      .select();
    newDeps = deps ?? [];
  }

  const { data: rows } = await supabase
    .from("row")
    .select("id")
    .eq("table_id", input.table_id);

  let newCells: Database["public"]["Tables"]["cell"]["Row"][] = [];
  if (rows && rows.length > 0) {
    const { data: cells } = await supabase
      .from("cell")
      .insert(
        rows.map((r) => ({
          column_id: column.id,
          row_id: r.id,
        })),
      )
      .select();
    newCells = cells ?? [];
  }

  return {
    column,
    cells: newCells,
    dependencies: newDeps,
  };
}

export async function deleteColumn(columnId: string) {
  const supabase = db();
  await supabase.from("cell").delete().eq("column_id", columnId);
  await supabase
    .from("column_dependency")
    .delete()
    .or(`source_column_id.eq.${columnId},target_column_id.eq.${columnId}`);
  const { error } = await supabase.from("column").delete().eq("id", columnId);
  if (error) throw error;
}

// ── Rows ────────────────────────────────────────────────

export async function createRow(tableId: string) {
  const supabase = db();

  const { data: maxRow } = await supabase
    .from("row")
    .select("index")
    .eq("table_id", tableId)
    .order("index", {
      ascending: false,
    })
    .limit(1)
    .single();
  const nextIndex = (maxRow?.index ?? -1) + 1;

  const { data: row, error } = await supabase
    .from("row")
    .insert({
      table_id: tableId,
      index: nextIndex,
    })
    .select()
    .single();
  if (error) throw error;

  const { data: columns } = await supabase
    .from("column")
    .select("id")
    .eq("table_id", tableId);

  if (columns && columns.length > 0) {
    const { data: newCells } = await supabase
      .from("cell")
      .insert(
        columns.map((c) => ({
          column_id: c.id,
          row_id: row.id,
        })),
      )
      .select();
    return {
      row,
      cells: newCells ?? [],
    };
  }

  return {
    row,
    cells: [] as NonNullable<typeof row>[],
  };
}

export async function deleteRow(rowId: string) {
  const supabase = db();
  await supabase.from("cell").delete().eq("row_id", rowId);
  const { error } = await supabase.from("row").delete().eq("id", rowId);
  if (error) throw error;
}

// ── Cells ───────────────────────────────────────────────

export async function updateCell(cellId: string, value: Json) {
  const { data, error } = await db()
    .from("cell")
    .update({
      value,
    })
    .eq("id", cellId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function refreshTableCells(tableId: string): Promise<CellRow[]> {
  const supabase = db();
  const { data: columns } = await supabase
    .from("column")
    .select("id")
    .eq("table_id", tableId);

  if (!columns || columns.length === 0) return [];

  const { data, error } = await supabase
    .from("cell")
    .select("*")
    .in(
      "column_id",
      columns.map((c) => c.id),
    );
  if (error) throw error;
  return data;
}

// ── Execution (column_program_run → executor) ───────────

let _demoUserId: string | null = null;

async function ensureDemoUser(): Promise<string> {
  if (_demoUserId) return _demoUserId;
  const supabase = db();

  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({
    perPage: 1,
  });
  if (users.length > 0) {
    _demoUserId = users[0].id;
    return _demoUserId;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.admin.createUser({
    email: "demo@marble.local",
    password: "marble-demo-password",
    email_confirm: true,
  });
  if (error) throw error;
  if (!user) throw new Error("Failed to create demo user");
  _demoUserId = user.id;
  return _demoUserId;
}

export async function executeRun(input: {
  programId: string;
  cellId: string;
  cellValue?: string;
}): Promise<{
  success: boolean;
  output: unknown;
  runId: string;
}> {
  const supabase = db();
  const userId = await ensureDemoUser();

  const { data: run, error } = await supabase
    .from("column_program_run")
    .insert({
      column_program_id: input.programId,
      target_cell_id: input.cellId,
      instigating_user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;

  const executorUrl = process.env.EXECUTOR_URL ?? "http://localhost:8787";

  const body: Record<string, unknown> = {};
  if (input.cellValue !== undefined) {
    body.$marble__cell_value = input.cellValue;
  }

  let result: {
    success?: boolean;
    output?: unknown;
    error?: boolean;
    message?: string;
  };
  try {
    const response = await fetch(`${executorUrl}?run_id=${run.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
    success: result.success ?? false,
    output: result.output,
    runId: run.id,
  };
}
