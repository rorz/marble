"use server";

import type { Database } from "@marble/supabase";
import { env } from "@/env";
import { requireUser } from "../../../../lib/auth";
import {
  createActingServiceRoleClient,
  createServiceRoleClient,
} from "../../../../lib/supabase/service-role";

type CellRow = Database["public"]["Tables"]["cell"]["Row"];
type ColumnUpdate = Database["public"]["Tables"]["column"]["Update"];
type RowRow = Database["public"]["Tables"]["row"]["Row"];
type DependencyRow = Database["public"]["Tables"]["column_dependency"]["Row"];
type Json = Database["public"]["Tables"]["cell"]["Row"]["state"];

const SUPABASE_SELECT_PAGE_SIZE = 1000;

function db() {
  return createServiceRoleClient();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveBaseOutputSchema(
  programVersion: Record<string, unknown>,
): Record<string, unknown> {
  const outputConfig = programVersion.output_config;
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
  const { profileId, supabase } = await createActingServiceRoleClient();
  const { data, error } = await supabase
    .from("table")
    .insert({
      name: "Untitled Table",
      owner_profile_id: profileId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTableName(id: string, name: string) {
  const { supabase } = await createActingServiceRoleClient();
  const { data, error } = await supabase
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
  const { supabase } = await createActingServiceRoleClient();
  const { error } = await supabase
    .from("program_version")
    .update({
      output_config: outputConfig as Json,
    })
    .eq("id", programVersionId);
  if (error) throw error;
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

  const columns = cols.data;
  const columnIds = columns.map((c) => c.id);

  if (columnIds.length === 0) {
    return {
      columns,
      rows,
      cells: [] as CellRow[],
      dependencies: [] as DependencyRow[],
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
    columns,
    rows,
    cells,
    dependencies,
  };
}

// ── Columns ─────────────────────────────────────────────

export async function createColumn(input: {
  table_id: string;
  name: string;
  program_id: string;
  input_template: string;
}) {
  const { supabase } = await createActingServiceRoleClient();

  const { data: program, error: programError } = await supabase
    .from("program_version")
    .select("*, program(*)")
    .eq("id", input.program_id)
    .single();
  if (programError) throw programError;

  const { data: maxCol } = await db()
    .from("column")
    .select("idx")
    .eq("table_id", input.table_id)
    .order("idx", {
      ascending: false,
    })
    .limit(1)
    .single();

  const nextIndex = (maxCol?.idx ?? -1) + 1;
  const outputSchema = resolveBaseOutputSchema(program);

  const { data: column, error } = await supabase
    .from("column")
    .insert({
      table_id: input.table_id,
      name: input.name,
      idx: nextIndex,
      program_version_id: input.program_id, // we might need to assume the passed string is a version id
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
  const { supabase } = await createActingServiceRoleClient();

  const { data: existing, error: existingError } = await supabase
    .from("column")
    .select("program_version_id, input_template")
    .eq("id", input.columnId)
    .single();
  if (existingError) throw existingError;

  const resolvedProgramId = input.program_id ?? existing.program_version_id;

  const { data: program, error: programError } = await supabase
    .from("program_version")
    .select("*, program(*)")
    .eq("id", resolvedProgramId)
    .single();
  if (programError) throw programError;

  const updates: ColumnUpdate = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.program_id !== undefined)
    updates.program_version_id = input.program_id;
  if (input.input_template !== undefined)
    updates.input_template = input.input_template;
  updates.output_schema = resolveBaseOutputSchema(program) as Json;

  const { data: column, error } = await supabase
    .from("column")
    .update(updates)
    .eq("id", input.columnId)
    .select("*, program_version(*, program(*))")
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
  const { supabase } = await createActingServiceRoleClient();

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
  const { supabase } = await createActingServiceRoleClient();

  const { data: maxRow } = await supabase
    .from("row")
    .select("idx")
    .eq("table_id", tableId)
    .order("idx", {
      ascending: false,
    })
    .limit(1)
    .single();

  const startIndex = (maxRow?.idx ?? -1) + 1;
  const rowsToInsert = Array.from(
    {
      length: count,
    },
    (_, i) => ({
      table_id: tableId,
      idx: startIndex + i,
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
  const { supabase } = await createActingServiceRoleClient();

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
  const { supabase } = await createActingServiceRoleClient();
  const { data, error } = await supabase
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

async function _ensureDemoUser(): Promise<string> {
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
  const { supabase } = await createActingServiceRoleClient();
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
      program_version_id: input.programId,
      target_cell_id: input.cellId,
    })
    .select("id")
    .single();
  if (error) throw error;

  const executorUrl = env.EXECUTOR_URL;

  let result: {
    success?: boolean;
    output?: unknown;
    error?: boolean;
    message?: string;
  };
  try {
    const response = await fetch(`${executorUrl}/run?run_id=${run.id}`, {
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
