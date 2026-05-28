import type { ResourceDeps } from "../../../db";
import { extractColumnInputTemplateDependencies } from "./input-template";

export const replaceColumnDependencies = async (
  deps: ResourceDeps,
  columnId: string,
  inputTemplate: string,
) => {
  const supabase = deps.serviceSupabase ?? deps.supabase;
  const sourceColumnIds = extractColumnInputTemplateDependencies(inputTemplate);
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
