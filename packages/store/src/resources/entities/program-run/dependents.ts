import type { SupabaseClient } from "@marble/supabase";
import { firstRelation, type StoredProgramRun } from "./load";

export const listDependentCandidateCellIds = async (
  supabase: SupabaseClient,
  input: {
    requestId?: string;
    successfulRuns: StoredProgramRun[];
    visitedCellIds: Set<string>;
  },
) => {
  const sourceColumnIds = Array.from(
    new Set(input.successfulRuns.map((run) => run.cell.column.id)),
  );

  if (sourceColumnIds.length === 0) {
    return [] as string[];
  }

  const { data: dependencies, error: dependencyError } = await supabase
    .from("column_dependency")
    .select("source_column_id, target_column_id")
    .in("source_column_id", sourceColumnIds);

  if (dependencyError) {
    throw new Error(dependencyError.message);
  }

  const dependencyRows = dependencies ?? [];

  if (dependencyRows.length === 0) {
    return [] as string[];
  }

  const targetColumnIds = Array.from(
    new Set(dependencyRows.map((dependency) => dependency.target_column_id)),
  );
  const { data: targetColumns, error: targetColumnError } = await supabase
    .from("column")
    .select("id, table_id, run_condition")
    .in("id", targetColumnIds);

  if (targetColumnError) {
    throw new Error(targetColumnError.message);
  }

  const targetColumnById = new Map(
    (targetColumns ?? [])
      .filter((column) => column.run_condition === true)
      .map((column) => [
        column.id,
        column,
      ]),
  );

  if (targetColumnById.size === 0) {
    return [] as string[];
  }

  const targetColumnIdsBySourceColumnId = new Map<string, string[]>();

  for (const dependency of dependencyRows) {
    if (!targetColumnById.has(dependency.target_column_id)) {
      continue;
    }

    const current =
      targetColumnIdsBySourceColumnId.get(dependency.source_column_id) ?? [];

    current.push(dependency.target_column_id);
    targetColumnIdsBySourceColumnId.set(dependency.source_column_id, current);
  }

  const externalTableIds = new Set<string>();
  const externalIdxValues = new Set<number>();

  for (const run of input.successfulRuns) {
    const row = firstRelation(run.cell.row);

    if (!row) {
      continue;
    }

    for (const targetColumnId of targetColumnIdsBySourceColumnId.get(
      run.cell.column.id,
    ) ?? []) {
      const targetColumn = targetColumnById.get(targetColumnId);

      if (!targetColumn || targetColumn.table_id === row.table_id) {
        continue;
      }

      externalTableIds.add(targetColumn.table_id);
      externalIdxValues.add(row.idx);
    }
  }

  const { data: externalRows, error: externalRowError } =
    externalTableIds.size === 0 || externalIdxValues.size === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("row")
          .select("id, idx, table_id")
          .in("table_id", Array.from(externalTableIds))
          .in("idx", Array.from(externalIdxValues));

  if (externalRowError) {
    throw new Error(externalRowError.message);
  }

  const rowIdByTableAndIdx = new Map(
    (externalRows ?? []).map((row) => [
      `${row.table_id}:${row.idx}`,
      row.id,
    ]),
  );
  const candidatePairs = new Map<
    string,
    {
      columnId: string;
      rowId: string;
    }
  >();

  for (const run of input.successfulRuns) {
    const row = firstRelation(run.cell.row);

    if (!row) {
      continue;
    }

    for (const targetColumnId of targetColumnIdsBySourceColumnId.get(
      run.cell.column.id,
    ) ?? []) {
      const targetColumn = targetColumnById.get(targetColumnId);

      if (!targetColumn) {
        continue;
      }

      const targetRowId =
        targetColumn.table_id === row.table_id
          ? row.id
          : rowIdByTableAndIdx.get(`${targetColumn.table_id}:${row.idx}`);

      if (!targetRowId) {
        continue;
      }

      candidatePairs.set(`${targetRowId}:${targetColumn.id}`, {
        columnId: targetColumn.id,
        rowId: targetRowId,
      });
    }
  }

  if (candidatePairs.size === 0) {
    return [] as string[];
  }

  const candidatePairValues = Array.from(candidatePairs.values());
  const { data: candidateCells, error: candidateCellError } = await supabase
    .from("cell")
    .select("id, row_id, column_id")
    .in(
      "row_id",
      Array.from(new Set(candidatePairValues.map((pair) => pair.rowId))),
    )
    .in(
      "column_id",
      Array.from(new Set(candidatePairValues.map((pair) => pair.columnId))),
    );

  if (candidateCellError) {
    throw new Error(candidateCellError.message);
  }

  const candidateCellIdByPair = new Map(
    (candidateCells ?? []).map((cell) => [
      `${cell.row_id}:${cell.column_id}`,
      cell.id,
    ]),
  );
  const candidateCellIds = Array.from(
    new Set(
      candidatePairValues
        .map((pair) =>
          candidateCellIdByPair.get(`${pair.rowId}:${pair.columnId}`),
        )
        .filter((cellId): cellId is string => cellId !== undefined),
    ),
  ).filter((cellId) => !input.visitedCellIds.has(cellId));

  return candidateCellIds;
};
