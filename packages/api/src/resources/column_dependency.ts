import type { Hono } from "hono";
import { type ApiEnv, mountResource } from "../core";
import {
  type DbRow,
  getRecord,
  listRecordsFromQuery,
  listRecordsInColumn,
} from "../data";
import { requestObject, uuidSchema } from "./shared";

const columnDependencyListSchema = requestObject({
  sourceColumnId: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
  targetColumnId: uuidSchema.optional(),
});

export function mountColumnDependencyResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      list: {
        handler: async (c, query) => {
          if (query.tableId) {
            await getRecord(c.var.supabase, "table", query.tableId);
            const columns = await listRecordsFromQuery(
              c.var.supabase,
              "column",
              {
                tableId: query.tableId,
              },
              {
                tableId: "table_id",
              },
            );
            const columnIds = columns.map((column) => column.id);

            if (columnIds.length === 0) {
              return [];
            }

            const [sourceResult, targetResult] = await Promise.all([
              listRecordsInColumn(
                c.var.supabase,
                "column_dependency",
                "source_column_id",
                columnIds,
              ),
              listRecordsInColumn(
                c.var.supabase,
                "column_dependency",
                "target_column_id",
                columnIds,
              ),
            ]);

            const merged = new Map<string, DbRow<"column_dependency">>();
            for (const dependency of [
              ...sourceResult,
              ...targetResult,
            ]) {
              merged.set(dependency.id, dependency);
            }

            return Array.from(merged.values()).filter((dependency) => {
              if (
                query.sourceColumnId &&
                dependency.source_column_id !== query.sourceColumnId
              ) {
                return false;
              }

              if (
                query.targetColumnId &&
                dependency.target_column_id !== query.targetColumnId
              ) {
                return false;
              }

              return true;
            });
          }

          return listRecordsFromQuery(
            c.var.supabase,
            "column_dependency",
            query,
            {
              sourceColumnId: "source_column_id",
              targetColumnId: "target_column_id",
            },
            [
              {
                column: "created_at",
              },
            ],
          );
        },
        schema: columnDependencyListSchema,
      },
      path: "/column-dependencies",
    },
    item: {
      get: {
        handler: (c, id) => getRecord(c.var.supabase, "column_dependency", id),
      },
      idParam: "dependencyId",
      path: "/column-dependencies/:dependencyId",
    },
  });
}
