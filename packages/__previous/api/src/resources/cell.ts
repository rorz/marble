import type { Json } from "@marble/supabase";
import type { Hono } from "hono";
import { z } from "zod";
import {
  type ApiEnv,
  ApiError,
  mountResource,
  requireAnyDefined,
  requiredParam,
} from "../core";
import { getRecord, listRecordsFromQuery, updateRecord } from "../data";
import {
  listAccessibleRowIds,
  requireAccessibleCell,
  requireAccessibleColumn,
  requireAccessibleRow,
  requireAccessibleTable,
} from "./access";
import { jsonValueSchema, requestObject, uuidSchema } from "./shared";

const cellListSchema = requestObject({
  columnId: uuidSchema.optional(),
  rowId: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

const cellPatchSchema = requestObject({
  manualInput: z.string().nullable().optional(),
  state: jsonValueSchema.optional(),
});

export function mountCellResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      list: {
        handler: async (c, query) => {
          let request = c.var.supabase.from("cell").select("*");

          if (query.rowId) {
            await requireAccessibleRow(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              rowId: query.rowId,
              userId: c.var.auth?.userId,
            });
            request = request.eq("row_id", query.rowId);
          }

          if (query.columnId) {
            await requireAccessibleColumn(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              columnId: query.columnId,
              userId: c.var.auth?.userId,
            });
            request = request.eq("column_id", query.columnId);
          }

          if (query.tableId) {
            await requireAccessibleTable(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              tableId: query.tableId,
              userId: c.var.auth?.userId,
            });
            const rows = await listRecordsFromQuery(
              c.var.supabase,
              "row",
              {
                tableId: query.tableId,
              },
              {
                tableId: "table_id",
              },
            );
            const rowIds = rows.map((row) => row.id);

            if (rowIds.length === 0) {
              return [];
            }

            request = request.in("row_id", rowIds);
          } else if (!query.rowId && !query.columnId) {
            const accessibleRowIds = await listAccessibleRowIds(
              c.var.supabase,
              {
                authenticatedProfileId: c.var.auth?.profileId,
                userId: c.var.auth?.userId,
              },
            );

            if (accessibleRowIds !== undefined) {
              if (accessibleRowIds.length === 0) {
                return [];
              }

              request = request.in("row_id", accessibleRowIds);
            }
          }

          const { data, error } = await request
            .order("row_id", {
              ascending: true,
            })
            .order("column_id", {
              ascending: true,
            });

          if (error) {
            throw new ApiError(500, error.message);
          }

          return data ?? [];
        },
        schema: cellListSchema,
      },
      path: "/cells",
    },
    item: {
      get: {
        handler: async (c, id) => {
          await requireAccessibleCell(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            cellId: id,
            userId: c.var.auth?.userId,
          });

          return getRecord(c.var.supabase, "cell", id, {
            select: "*, program_run(*)",
          });
        },
      },
      idParam: "cellId",
      patch: {
        handler: async (c, id, body) => {
          await requireAccessibleCell(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            cellId: id,
            userId: c.var.auth?.userId,
          });
          requireAnyDefined([
            body.manualInput,
            body.state,
          ]);

          return updateRecord(c.var.supabase, "cell", id, {
            manual_input: body.manualInput,
            state: body.state as Json | undefined,
          });
        },
        schema: cellPatchSchema,
      },
      path: "/cells/:cellId",
    },
  });

  mountResource(app, {
    collection: {
      list: {
        handler: async (c) => {
          const rowId = requiredParam(c, "rowId");
          await requireAccessibleRow(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            rowId,
            userId: c.var.auth?.userId,
          });

          return listRecordsFromQuery(
            c.var.supabase,
            "cell",
            {
              rowId,
            },
            {
              rowId: "row_id",
            },
            [
              {
                column: "column_id",
              },
            ],
          );
        },
      },
      path: "/rows/:rowId/cells",
    },
  });

  mountResource(app, {
    collection: {
      list: {
        handler: async (c) => {
          const columnId = requiredParam(c, "columnId");
          await requireAccessibleColumn(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            columnId,
            userId: c.var.auth?.userId,
          });

          return listRecordsFromQuery(
            c.var.supabase,
            "cell",
            {
              columnId,
            },
            {
              columnId: "column_id",
            },
            [
              {
                column: "row_id",
              },
            ],
          );
        },
      },
      path: "/columns/:columnId/cells",
    },
  });
}
