import type { ResourceDeps } from "../../../db";
import { extractColumnInputTemplateDependencies } from "./input-template";

type ColumnProjectScope = {
  columnId: string;
  projectId: string;
};

const loadColumnProjectScopes = async (
  deps: ResourceDeps,
  columnIds: string[],
): Promise<ColumnProjectScope[]> => {
  const supabase = deps.serviceSupabase ?? deps.supabase;
  const uniqueColumnIds = Array.from(new Set(columnIds));

  if (uniqueColumnIds.length === 0) {
    return [];
  }

  const { data: columns, error: columnError } = await supabase
    .from("column")
    .select("id, table_id")
    .in("id", uniqueColumnIds);

  if (columnError) {
    throw new Error(columnError.message);
  }

  if ((columns ?? []).length !== uniqueColumnIds.length) {
    throw new Error("Column dependency references an unknown column.");
  }

  const tableIds = Array.from(
    new Set((columns ?? []).map((column) => column.table_id)),
  );
  const { data: tables, error: tableError } = await supabase
    .from("table")
    .select("id, project_id")
    .in("id", tableIds);

  if (tableError) {
    throw new Error(tableError.message);
  }

  const projectIdByTableId = new Map(
    (tables ?? []).map((table) => [
      table.id,
      table.project_id,
    ]),
  );

  return (columns ?? []).map((column) => {
    const projectId = projectIdByTableId.get(column.table_id);

    if (!projectId) {
      throw new Error("Column dependency references an unknown table.");
    }

    return {
      columnId: column.id,
      projectId,
    };
  });
};

const assertColumnDependenciesWithinTargetProject = async (
  deps: ResourceDeps,
  targetColumnId: string,
  sourceColumnIds: string[],
) => {
  if (sourceColumnIds.length === 0) {
    return;
  }

  const projectIdByColumnId = new Map(
    (
      await loadColumnProjectScopes(deps, [
        targetColumnId,
        ...sourceColumnIds,
      ])
    ).map((scope) => [
      scope.columnId,
      scope.projectId,
    ]),
  );
  const targetProjectId = projectIdByColumnId.get(targetColumnId);

  if (!targetProjectId) {
    throw new Error("Column dependency target could not be resolved.");
  }

  const hasCrossProjectDependency = sourceColumnIds.some(
    (sourceColumnId) =>
      projectIdByColumnId.get(sourceColumnId) !== targetProjectId,
  );

  if (hasCrossProjectDependency) {
    throw new Error("Column dependencies must stay within the same project.");
  }
};

export const replaceColumnDependencies = async (
  deps: ResourceDeps,
  columnId: string,
  inputTemplate: string,
) => {
  const supabase = deps.serviceSupabase ?? deps.supabase;
  const sourceColumnIds = extractColumnInputTemplateDependencies(inputTemplate);

  await assertColumnDependenciesWithinTargetProject(
    deps,
    columnId,
    sourceColumnIds,
  );

  const deleteResult = await supabase
    .from("column_dependency")
    .delete()
    .eq("target_column_id", columnId);

  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  if (sourceColumnIds.length === 0) {
    return;
  }

  const insertResult = await supabase.from("column_dependency").insert(
    sourceColumnIds.map((sourceColumnId) => ({
      source_column_id: sourceColumnId,
      target_column_id: columnId,
    })),
  );

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }
};

export const deleteColumnDependencies = async (
  deps: ResourceDeps,
  columnId: string,
) => {
  const supabase = deps.serviceSupabase ?? deps.supabase;

  const [sourceResult, targetResult] = await Promise.all([
    supabase
      .from("column_dependency")
      .delete()
      .eq("source_column_id", columnId),
    supabase
      .from("column_dependency")
      .delete()
      .eq("target_column_id", columnId),
  ]);

  if (sourceResult.error || targetResult.error) {
    throw new Error(
      sourceResult.error?.message ??
        targetResult.error?.message ??
        "Could not delete column dependencies.",
    );
  }
};
