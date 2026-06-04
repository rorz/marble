import { extractColumnInputTemplateDependencies } from "@marble/contracts";

import type { Column } from "../types";

type ColumnDependencyOrder = {
  dependencies: Map<string, string[]>;
  hasCycle: boolean;
  ordered: Column[];
};

/**
 * Topologically orders columns so that a column's dependencies run before it.
 * Dependencies are extracted from each column's input template and restricted
 * to the provided set (references to columns outside the set — e.g. manual
 * input columns or other tables — never block ordering). Ties break on `idx`
 * so the natural left-to-right layout is preserved. On a dependency cycle the
 * remaining columns are appended in `idx` order and `hasCycle` is set.
 */
export const orderColumnsByDependency = (
  columns: Column[],
): ColumnDependencyOrder => {
  const idSet = new Set(columns.map((column) => column.id));
  const dependencies = new Map<string, string[]>();

  for (const column of columns) {
    const referenced = extractColumnInputTemplateDependencies(
      column.inputTemplate,
    ).filter((id) => id !== column.id && idSet.has(id));
    dependencies.set(column.id, Array.from(new Set(referenced)));
  }

  const byIdx = [
    ...columns,
  ].sort((a, b) => a.idx - b.idx);
  const ordered: Column[] = [];
  const placed = new Set<string>();
  let progressed = true;

  while (placed.size < columns.length && progressed) {
    progressed = false;

    for (const column of byIdx) {
      if (placed.has(column.id)) {
        continue;
      }

      const unmet = (dependencies.get(column.id) ?? []).some(
        (dependencyId) => !placed.has(dependencyId),
      );
      if (unmet) {
        continue;
      }

      ordered.push(column);
      placed.add(column.id);
      progressed = true;
    }
  }

  if (placed.size < columns.length) {
    for (const column of byIdx) {
      if (!placed.has(column.id)) {
        ordered.push(column);
      }
    }

    return {
      dependencies,
      hasCycle: true,
      ordered,
    };
  }

  return {
    dependencies,
    hasCycle: false,
    ordered,
  };
};
