import type { Json, SupabaseClient } from "@marble/supabase";
import type { JsonValue, StoredProgramRun } from "./load";

export const createPendingForCellIds = async (
  supabase: SupabaseClient,
  cellIds: string[],
) => {
  const uniqueCellIds = Array.from(new Set(cellIds));

  if (uniqueCellIds.length === 0) {
    return [] as string[];
  }

  const { data: cells, error: cellError } = await supabase
    .from("cell")
    .select("id, column_id")
    .in("id", uniqueCellIds);

  if (cellError) {
    throw new Error(cellError.message);
  }

  const cellsById = new Map(
    (cells ?? []).map((cell) => [
      cell.id,
      cell,
    ]),
  );

  if (cellsById.size !== uniqueCellIds.length) {
    throw new Error("Could not resolve every cell for execution.");
  }

  const columnIds = Array.from(
    new Set(
      uniqueCellIds.map((cellId) => {
        const cell = cellsById.get(cellId);

        if (!cell) {
          throw new Error(`Cell '${cellId}' was not found.`);
        }

        return cell.column_id;
      }),
    ),
  );
  const { data: columns, error: columnError } = await supabase
    .from("column")
    .select("id, program_version_id")
    .in("id", columnIds);

  if (columnError) {
    throw new Error(columnError.message);
  }

  const programVersionIdByColumnId = new Map(
    (columns ?? []).map((column) => [
      column.id,
      column.program_version_id,
    ]),
  );

  const { error: pendingStateError } = await supabase
    .from("cell")
    .update({
      state: {
        ok: null,
      } as Json,
    })
    .in("id", uniqueCellIds);

  if (pendingStateError) {
    throw new Error(pendingStateError.message);
  }

  const { data: runs, error: runError } = await supabase
    .from("program_run")
    .insert(
      uniqueCellIds.map((cellId) => {
        const cell = cellsById.get(cellId);

        if (!cell) {
          throw new Error(`Cell '${cellId}' was not found.`);
        }

        const programVersionId = programVersionIdByColumnId.get(cell.column_id);

        if (!programVersionId) {
          throw new Error(
            `Program version for column '${cell.column_id}' was not found.`,
          );
        }

        return {
          program_version_id: programVersionId,
          target_cell_id: cellId,
        };
      }),
    )
    .select("id, target_cell_id");

  if (runError) {
    throw new Error(runError.message);
  }

  const runIdByCellId = new Map(
    (runs ?? []).map((run) => [
      run.target_cell_id,
      run.id,
    ]),
  );

  return uniqueCellIds.map((cellId) => {
    const runId = runIdByCellId.get(cellId);

    if (!runId) {
      throw new Error(`Run for cell '${cellId}' was not created.`);
    }

    return runId;
  });
};

export const persistFailure = async (
  supabase: SupabaseClient,
  run: StoredProgramRun,
  failState: JsonValue,
) => {
  const results = await Promise.all([
    supabase
      .from("cell")
      .update({
        state: failState as Json,
      })
      .eq("id", run.target_cell_id),
    supabase
      .from("program_run")
      .update({
        output: failState as Json,
      })
      .eq("id", run.id),
  ]);

  for (const result of results) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }
};

export const persistSuccess = async (
  supabase: SupabaseClient,
  input: {
    output: JsonValue;
    parsedInput: JsonValue;
    run: StoredProgramRun;
  },
) => {
  const results = await Promise.all([
    supabase
      .from("cell")
      .update({
        state: input.output as Json,
      })
      .eq("id", input.run.target_cell_id),
    supabase
      .from("program_run")
      .update({
        input: input.parsedInput as Json,
        output: input.output as Json,
      })
      .eq("id", input.run.id),
  ]);

  for (const result of results) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }
};

export const setCellState = async (
  supabase: SupabaseClient,
  input: {
    cellId: string;
    state: JsonValue;
  },
) => {
  const { error } = await supabase
    .from("cell")
    .update({
      state: input.state as Json,
    })
    .eq("id", input.cellId);

  if (error) {
    throw new Error(error.message);
  }
};
