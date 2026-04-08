"use server";

import type { Database } from "@marble/supabase";
import { createClient } from "@marble/supabase";
import { requireUser } from "../../../../lib/auth";

type CellRow = Database["public"]["Tables"]["cell"]["Row"];
type ColumnUpdate = Database["public"]["Tables"]["column"]["Update"];
type ProgramRow = Database["public"]["Tables"]["program"]["Row"];
type Json = Database["public"]["Tables"]["cell"]["Row"]["state"];

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveBaseOutputSchema(program: ProgramRow): Record<string, unknown> {
  const programRecord = program as unknown as Record<string, unknown>;
  const outputConfig =
    programRecord.output_config ?? programRecord.output_value_schema;
  if (!isRecord(outputConfig)) return {};

  const baseSchema = isRecord(outputConfig.schema) ? outputConfig.schema : {};
  return baseSchema;
}

function extractDependenciesFromTemplate(templateStr: string): string[] {
  const sourceColumnIds = new Set<string>();
  let template: unknown;
  try {
    template = JSON.parse(templateStr);
  } catch {
    return [];
  }

  const jsonPathPattern = /^\$\.columns\.([a-f0-9-]+)\./;
  const tagPattern = /\{\{\$\.columns\.([a-f0-9-]+)\.[^}]+\}\}/g;

  const extractFromValue = (value: unknown) => {
    if (typeof value === "string") {
      const matches = [
        ...value.matchAll(tagPattern),
      ];
      for (const match of matches) {
        sourceColumnIds.add(match[1]);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) extractFromValue(item);
    } else if (value && typeof value === "object") {
      for (const [key, val] of Object.entries(value)) {
        if (key.endsWith(".$") && typeof val === "string") {
          const match = val.match(jsonPathPattern);
          if (match) sourceColumnIds.add(match[1]);
        }
        extractFromValue(val);
      }
    }
  };

  extractFromValue(template);
  return Array.from(sourceColumnIds);
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
  await requireUser();
  const { data, error } = await db()
    .from("table")
    .insert({
      name: "Untitled Table",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTableName(id: string, name: string) {
  await requireUser();
  const { data, error } = await db()
    .from("table")
    .update({
      name,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Programs ────────────────────────────────────────────

export async function listPrograms(): Promise<ProgramRow[]> {
  await requireUser();
  const { data, error } = await db()
    .from("program")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function updateProgramOutputSchema(
  programId: string,
  outputConfig: unknown,
) {
  await requireUser();
  const { error } = await db()
    .from("program")
    .update({
      output_config: outputConfig as Json,
    })
    .eq("id", programId);
  if (error) throw error;
}

// ── Table data (columns + rows + cells) ─────────────────

export async function loadTableData(tableId: string) {
  await requireUser();
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
  await requireUser();
  const supabase = db();

  const { data: program, error: programError } = await supabase
    .from("program")
    .select("*")
    .eq("id", input.program_id)
    .single();
  if (programError) throw programError;

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
  const outputSchema = resolveBaseOutputSchema(program);

  const { data: column, error } = await supabase
    .from("column")
    .insert({
      table_id: input.table_id,
      name: input.name,
      index: nextIndex,
      program_id: input.program_id,
      input_template: input.input_template,
      output_schema: outputSchema as Json,
    })
    .select("*, program(*)")
    .single();
  if (error) throw error;

  // Derive column_dependency from any `.$` keys or interpolation tags referencing $.columns.<id>
  const sourceColumnIds = extractDependenciesFromTemplate(input.input_template);

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

export async function updateColumn(input: {
  columnId: string;
  name?: string;
  program_id?: string;
  input_template?: string;
}) {
  await requireUser();
  const supabase = db();

  const { data: existing, error: existingError } = await supabase
    .from("column")
    .select("program_id, input_template")
    .eq("id", input.columnId)
    .single();
  if (existingError) throw existingError;

  const resolvedProgramId = input.program_id ?? existing.program_id;

  const { data: program, error: programError } = await supabase
    .from("program")
    .select("*")
    .eq("id", resolvedProgramId)
    .single();
  if (programError) throw programError;

  const updates: ColumnUpdate = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.program_id !== undefined) updates.program_id = input.program_id;
  if (input.input_template !== undefined)
    updates.input_template = input.input_template;
  updates.output_schema = resolveBaseOutputSchema(program) as Json;

  const { data: column, error } = await supabase
    .from("column")
    .update(updates)
    .eq("id", input.columnId)
    .select("*, program(*)")
    .single();
  if (error) throw error;

  if (input.input_template !== undefined) {
    await supabase
      .from("column_dependency")
      .delete()
      .eq("target_column_id", input.columnId);

    const sourceColumnIds = extractDependenciesFromTemplate(
      input.input_template,
    );

    if (sourceColumnIds.length > 0) {
      await supabase
        .from("column_dependency")
        .insert(
          sourceColumnIds.map((srcId) => ({
            source_column_id: srcId,
            target_column_id: input.columnId,
          })),
        )
        .select();
    }
  }

  return column;
}

export async function deleteColumn(columnId: string) {
  await requireUser();
  const supabase = db();

  const { data: cellIds } = await supabase
    .from("cell")
    .select("id")
    .eq("column_id", columnId);

  if (cellIds && cellIds.length > 0) {
    await supabase
      .from("program_run")
      .delete()
      .in(
        "target_cell_id",
        cellIds.map((c) => c.id),
      );
  }

  await supabase.from("cell").delete().eq("column_id", columnId);
  await supabase
    .from("column_dependency")
    .delete()
    .or(`source_column_id.eq.${columnId},target_column_id.eq.${columnId}`);
  const { error } = await supabase.from("column").delete().eq("id", columnId);
  if (error) throw error;
}

// ── Rows ────────────────────────────────────────────────

export async function createRows(tableId: string, count = 1) {
  await requireUser();
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

  const startIndex = (maxRow?.index ?? -1) + 1;
  const rowsToInsert = Array.from(
    {
      length: count,
    },
    (_, i) => ({
      table_id: tableId,
      index: startIndex + i,
    }),
  );

  const { data: newRows, error } = await supabase
    .from("row")
    .insert(rowsToInsert)
    .select();
  if (error) throw error;

  const { data: columns } = await supabase
    .from("column")
    .select("id")
    .eq("table_id", tableId);

  if (columns && columns.length > 0 && newRows && newRows.length > 0) {
    const cellsToInsert = newRows.flatMap((row) =>
      columns.map((c) => ({
        column_id: c.id,
        row_id: row.id,
      })),
    );
    const { data: newCells } = await supabase
      .from("cell")
      .insert(cellsToInsert)
      .select();
    return {
      rows: newRows ?? [],
      cells: newCells ?? [],
    };
  }

  return {
    rows: newRows ?? [],
    cells: [] as CellRow[],
  };
}

export async function deleteRow(rowId: string) {
  await requireUser();
  const supabase = db();

  const { data: cellIds } = await supabase
    .from("cell")
    .select("id")
    .eq("row_id", rowId);

  if (cellIds && cellIds.length > 0) {
    await supabase
      .from("program_run")
      .delete()
      .in(
        "target_cell_id",
        cellIds.map((c) => c.id),
      );
  }

  await supabase.from("cell").delete().eq("row_id", rowId);
  const { error } = await supabase.from("row").delete().eq("id", rowId);
  if (error) throw error;
}

// ── Cells ───────────────────────────────────────────────

export async function updateCellManualInput(cellId: string, value: string) {
  await requireUser();
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

async function ensureDemoUser(): Promise<string> {
  const supabase = db();

  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({
    perPage: 1,
  });
  if (users.length > 0) {
    return users[0].id;
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
  return user.id;
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
  await requireUser();
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
