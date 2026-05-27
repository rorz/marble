import type { SupabaseClient, Tables } from "@marble/supabase";
import { readProgramConfigFromFiles } from "../program-file/config";
import { firstRelation, type JsonValue, type StoredProgramRun } from "./load";

type ProgramRunBaseInputContext = {
  cell: Pick<Tables<"cell">, "id" | "manual_input" | "state">;
  column: Pick<
    Tables<"column">,
    | "id"
    | "input_template"
    | "program_version_id"
    | "run_condition"
    | "table_id"
  >;
  programConfig: {
    inputSchema: JsonValue;
  };
  programVersion: Pick<Tables<"program_version">, "id">;
  row: Pick<Tables<"row">, "id" | "idx" | "table_id">;
};

export type ProgramRunInputContext = ProgramRunBaseInputContext & {
  columns: Record<
    string,
    {
      ready: boolean;
      value: JsonValue;
    }
  >;
};

export const createExecutionInputContextFromStoredRun = (
  run: StoredProgramRun,
): ProgramRunBaseInputContext => {
  const row = firstRelation(run.cell.row);

  if (!row) {
    throw new Error("Could not resolve the run row.");
  }

  return {
    cell: {
      id: run.cell.id,
      manual_input: run.cell.manual_input,
      state: run.cell.state,
    },
    column: {
      id: run.cell.column.id,
      input_template: run.cell.column.input_template,
      program_version_id: run.cell.column.program_version_id,
      run_condition: run.cell.column.run_condition,
      table_id: run.cell.column.table_id,
    },
    programConfig: {
      inputSchema: readProgramConfigFromFiles(run.program_version.program_file)
        .inputSchema as JsonValue,
    },
    programVersion: {
      id: run.program_version.id,
    },
    row: {
      id: row.id,
      idx: row.idx,
      table_id: row.table_id,
    },
  };
};

export const loadExecutionInputContextForCell = async (
  supabase: SupabaseClient,
  cellId: string,
): Promise<ProgramRunBaseInputContext> => {
  const { data: cellRecord, error: cellError } = await supabase
    .from("cell")
    .select(
      "id, manual_input, state, row!cell_row_id_fkey(id, idx, table_id), column!cell_column_id_fkey(id, input_template, program_version_id, run_condition, table_id)",
    )
    .eq("id", cellId)
    .maybeSingle();

  if (cellError) {
    throw new Error(cellError.message);
  }

  if (!cellRecord) {
    throw new Error(`No cell found for '${cellId}'.`);
  }

  const row = firstRelation(cellRecord.row);
  const column = firstRelation(cellRecord.column);

  if (!row || !column) {
    throw new Error(
      `Could not resolve execution context for cell '${cellId}'.`,
    );
  }

  const { data: programVersion, error: programVersionError } = await supabase
    .from("program_version")
    .select("id, program_file(content, filename)")
    .eq("id", column.program_version_id)
    .maybeSingle();

  if (programVersionError) {
    throw new Error(programVersionError.message);
  }

  if (!programVersion) {
    throw new Error(
      `Program version '${column.program_version_id}' was not found.`,
    );
  }

  return {
    cell: {
      id: cellRecord.id,
      manual_input: cellRecord.manual_input,
      state: cellRecord.state,
    },
    column: {
      id: column.id,
      input_template: column.input_template,
      program_version_id: column.program_version_id,
      run_condition: column.run_condition,
      table_id: column.table_id,
    },
    programConfig: {
      inputSchema: readProgramConfigFromFiles(programVersion.program_file ?? [])
        .inputSchema as JsonValue,
    },
    programVersion: {
      id: programVersion.id,
    },
    row: {
      id: row.id,
      idx: row.idx,
      table_id: row.table_id,
    },
  };
};

export const loadInputContext = async (
  supabase: SupabaseClient,
  context: ProgramRunBaseInputContext,
): Promise<ProgramRunInputContext> => {
  const { data: dependencies, error: dependenciesError } = await supabase
    .from("column_dependency")
    .select("source_column_id")
    .eq("target_column_id", context.column.id);

  if (dependenciesError) {
    throw new Error(dependenciesError.message);
  }

  const sourceColumnIds =
    dependencies?.map((entry) => entry.source_column_id) ?? [];
  const { data: sourceColumnData, error: sourceColumnError } =
    sourceColumnIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("column")
          .select("id, table_id")
          .in("id", sourceColumnIds);

  if (sourceColumnError) {
    throw new Error(sourceColumnError.message);
  }

  const sourceColumns = sourceColumnData ?? [];
  const externalTableIds = Array.from(
    new Set(
      sourceColumns
        .map((column) => column.table_id)
        .filter((tableId) => tableId !== context.row.table_id),
    ),
  );
  const { data: externalRowData, error: externalRowError } =
    externalTableIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("row")
          .select("id, table_id")
          .eq("idx", context.row.idx)
          .in("table_id", externalTableIds);

  if (externalRowError) {
    throw new Error(externalRowError.message);
  }

  const rowsByTableId = new Map(
    (externalRowData ?? []).map((row) => [
      row.table_id,
      row.id,
    ]),
  );
  const dependencyRowIds = Array.from(
    new Set(
      sourceColumns.flatMap((column) =>
        column.table_id === context.row.table_id
          ? [
              context.row.id,
            ]
          : rowsByTableId.has(column.table_id)
            ? [
                rowsByTableId.get(column.table_id) as string,
              ]
            : [],
      ),
    ),
  );
  const { data: dependencyCellData, error: dependencyCellError } =
    sourceColumns.length === 0 || dependencyRowIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("cell")
          .select("*")
          .in("column_id", sourceColumnIds)
          .in("row_id", dependencyRowIds);

  if (dependencyCellError) {
    throw new Error(dependencyCellError.message);
  }

  const dependencyCellByColumnAndRowId = new Map(
    (dependencyCellData ?? []).map((cell) => [
      `${cell.column_id}:${cell.row_id}`,
      cell,
    ]),
  );
  const dependencyRowIdByColumnId = new Map(
    sourceColumns.map((column) => [
      column.id,
      column.table_id === context.row.table_id
        ? context.row.id
        : rowsByTableId.get(column.table_id),
    ]),
  );
  const columns = Object.fromEntries(
    sourceColumns.map((column) => {
      const rowId = dependencyRowIdByColumnId.get(column.id);
      const cell = rowId
        ? dependencyCellByColumnAndRowId.get(`${column.id}:${rowId}`)
        : undefined;
      const state = cell?.state as
        | {
            ok?: boolean;
            value?: JsonValue;
          }
        | null
        | undefined;
      const ready = state?.ok === true;

      return [
        column.id,
        {
          ready,
          value: ready ? (state.value ?? null) : null,
        },
      ];
    }),
  ) as ProgramRunInputContext["columns"];

  return {
    ...context,
    columns,
  };
};
