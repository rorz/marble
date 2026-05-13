import type { ResourceDeps } from "../../../db";

function extractDependenciesFromTemplate(template: string) {
  const sourceColumnIds = new Set<string>();
  let parsedTemplate: unknown;

  try {
    parsedTemplate = JSON.parse(template);
  } catch {
    return [];
  }

  const jsonPathPattern = /^\$\.columns\.([a-f0-9-]+)\./;
  const interpolationPattern = /\{\{\$\.columns\.([a-f0-9-]+)\.[^}]+\}\}/g;

  const visit = (value: unknown) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(interpolationPattern)) {
        sourceColumnIds.add(match[1]);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        if (
          key === "$marble_ref" &&
          Array.isArray(entry) &&
          entry[0] === "columns"
        ) {
          sourceColumnIds.add(String(entry[1]));
        } else if (key.endsWith(".$") && typeof entry === "string") {
          const match = entry.match(jsonPathPattern);

          if (match) {
            sourceColumnIds.add(match[1]);
          }
        }

        visit(entry);
      }
    }
  };

  visit(parsedTemplate);
  return Array.from(sourceColumnIds);
}

export async function replaceColumnDependencies(
  deps: ResourceDeps,
  columnId: string,
  inputTemplate: string,
) {
  const supabase = deps.serviceSupabase ?? deps.supabase;
  const sourceColumnIds = extractDependenciesFromTemplate(inputTemplate);
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
}

export async function deleteColumnDependencies(
  deps: ResourceDeps,
  columnId: string,
) {
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
}
