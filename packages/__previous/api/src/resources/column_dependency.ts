import type { Hono } from "hono";
import { type ApiEnv, ApiError, mountResource } from "../core";
import {
  type DbRow,
  getRecord,
  listRecordsFromQuery,
  listRecordsInColumn,
} from "../data";
import {
  listAccessibleColumnIds,
  requireAccessibleColumn,
  requireAccessibleTable,
} from "./access";
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
          const mergeDependencies = (
            dependencyGroups: DbRow<"column_dependency">[][],
          ) =>
            Array.from(
              new Map(
                dependencyGroups.flat().map((dependency) => [
                  dependency.id,
                  dependency,
                ]),
              ).values(),
            ).sort((left, right) =>
              left.created_at.localeCompare(right.created_at),
            );

          if (query.tableId) {
            await requireAccessibleTable(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              tableId: query.tableId,
              userId: c.var.auth?.userId,
            });
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

            const dependencyGroups = await Promise.all([
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

            return mergeDependencies(dependencyGroups).filter((dependency) => {
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

          if (query.sourceColumnId) {
            await requireAccessibleColumn(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              columnId: query.sourceColumnId,
              userId: c.var.auth?.userId,
            });
          }

          if (query.targetColumnId) {
            await requireAccessibleColumn(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              columnId: query.targetColumnId,
              userId: c.var.auth?.userId,
            });
          }

          if (query.sourceColumnId || query.targetColumnId) {
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
          }

          const accessibleColumnIds = await listAccessibleColumnIds(
            c.var.supabase,
            {
              authenticatedProfileId: c.var.auth?.profileId,
              userId: c.var.auth?.userId,
            },
          );

          if (accessibleColumnIds !== undefined) {
            if (accessibleColumnIds.length === 0) {
              return [];
            }

            return mergeDependencies(
              await Promise.all([
                listRecordsInColumn(
                  c.var.supabase,
                  "column_dependency",
                  "source_column_id",
                  accessibleColumnIds,
                ),
                listRecordsInColumn(
                  c.var.supabase,
                  "column_dependency",
                  "target_column_id",
                  accessibleColumnIds,
                ),
              ]),
            );
          }

          const { data, error } = await c.var.supabase
            .from("column_dependency")
            .select("*")
            .order("created_at", {
              ascending: true,
            });

          if (error) {
            throw new ApiError(500, error.message);
          }

          return data ?? [];
        },
        schema: columnDependencyListSchema,
      },
      path: "/column-dependencies",
    },
    item: {
      get: {
        handler: async (c, id) => {
          const dependency = await getRecord(
            c.var.supabase,
            "column_dependency",
            id,
          );
          const targetColumn = await getRecord(
            c.var.supabase,
            "column",
            dependency.target_column_id,
          );
          await requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId: targetColumn.table_id,
            userId: c.var.auth?.userId,
          });
          return dependency;
        },
      },
      idParam: "dependencyId",
      path: "/column-dependencies/:dependencyId",
    },
  });
}
