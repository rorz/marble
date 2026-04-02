"use server";

import type { Database } from "@marble/supabase";
import { createClient } from "@marble/supabase";

type CellRow = Database["public"]["Tables"]["cell"]["Row"];
type ProgramRow = Database["public"]["Tables"]["program"]["Row"];

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

// ── Programs ────────────────────────────────────────────

export async function listPrograms(): Promise<ProgramRow[]> {
  const { data, error } = await db()
    .from("program")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

// ── Table data (columns + rows + cells) ─────────────────

export async function loadTableData(tableId: string) {
  const supabase = db();

  const [cols, rowsRes] = await Promise.all([
    supabase
      .from("column")
      .select("*, program(*)")
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

// ── Columns ─────────────────────────────────────────────

export async function createColumn(input: {
  table_id: string;
  name: string;
  program_id: string;
  input_template: string;
}) {
  const supabase = db();

  const { data: maxCol } = await supabase
    .from("column")
    .select("index")
    .eq("table_id", input.table_id)
    .order("index", {
      ascending: false,
    })
    .limit(1)
    .single();

  const nextIndex = (maxCol?.index ?? -1) + 1;

  const { data: column, error } = await supabase
    .from("column")
    .insert({
      table_id: input.table_id,
      name: input.name,
      index: nextIndex,
      program_id: input.program_id,
      input_template: input.input_template,
    })
    .select("*, program(*)")
    .single();
  if (error) throw error;

  // Derive column_dependency from any `.$` keys referencing $.columns.<id>
  const template: Record<string, unknown> = JSON.parse(input.input_template);
  const colRefPattern = /^\$\.columns\.([a-f0-9-]+)\./;
  const sourceColumnIds: string[] = [];
  for (const [key, value] of Object.entries(template)) {
    if (key.endsWith(".$") && typeof value === "string") {
      const match = value.match(colRefPattern);
      if (match) sourceColumnIds.push(match[1]);
    }
  }

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

  // Auto-create cells for existing rows
  const { data: rows } = await supabase
    .from("row")
    .select("id")
    .eq("table_id", input.table_id);

  let newCells: CellRow[] = [];
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

  const { data: row, error } = await supabase
    .from("row")
    .insert({
      table_id: tableId,
      index: (maxRow?.index ?? -1) + 1,
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
    cells: [] as CellRow[],
  };
}

export async function deleteRow(rowId: string) {
  const supabase = db();
  await supabase.from("cell").delete().eq("row_id", rowId);
  const { error } = await supabase.from("row").delete().eq("id", rowId);
  if (error) throw error;
}

// ── Cells ───────────────────────────────────────────────

export async function updateCellManualInput(cellId: string, value: string) {
  const { data, error } = await db()
    .from("cell")
    .update({
      manual_input: value,
    })
    .eq("id", cellId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Execution ───────────────────────────────────────────

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

  // Persist manual_input if provided (cell edit flow)
  if (input.cellValue !== undefined) {
    await supabase
      .from("cell")
      .update({
        manual_input: input.cellValue,
      })
      .eq("id", input.cellId);
  }

  // Set loading sentinel — realtime picks this up so the UI can show a spinner
  await supabase
    .from("cell")
    .update({
      state: {
        ok: null,
      },
    })
    .eq("id", input.cellId);

  const { data: run, error } = await supabase
    .from("program_run")
    .insert({
      program_id: input.programId,
      target_cell_id: input.cellId,
      instigating_user_id: userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  const executorUrl = process.env.EXECUTOR_URL ?? "http://localhost:8787";

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
      body: "{}",
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
