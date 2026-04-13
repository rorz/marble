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
            request = request.eq("row_id", query.rowId);
          }

          if (query.columnId) {
            request = request.eq("column_id", query.columnId);
          }

          if (query.tableId) {
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
        handler: (c, id) =>
          getRecord(c.var.supabase, "cell", id, {
            select: "*, program_run(*)",
          }),
      },
      idParam: "cellId",
      patch: {
        handler: async (c, id, body) => {
          await getRecord(c.var.supabase, "cell", id, {
            select: "*, program_run(*)",
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
          await getRecord(c.var.supabase, "row", rowId);

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
          await getRecord(c.var.supabase, "column", columnId);

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
