import type { Hono } from "hono";
import { z } from "zod";
import {
  type ApiContext,
  type ApiEnv,
  ApiError,
  mountResource,
  requireAnyDefined,
  requiredParam,
} from "../core";
import {
  createRecords,
  createRecordsWithGeneratedIndex,
  deleteRecord,
  deleteRecordsByColumn,
  deleteRecordsInColumn,
  getRecord,
  listRecordsFromQuery,
  successResponse,
  updateRecord,
} from "../data";
import { deleteProgramRunsForCellIds } from "./program_run";
import { requestObject, uuidSchema } from "./shared";

const rowListSchema = requestObject({
  tableId: uuidSchema.optional(),
});

const rowCreateSchema = requestObject({
  count: z.number().int().positive().optional(),
  idx: z.number().int().nonnegative().optional(),
  tableId: uuidSchema.optional(),
});

const rowPatchSchema = requestObject({
  idx: z.number().int().nonnegative().optional(),
});

async function createRows(
  c: ApiContext,
  body: z.infer<typeof rowCreateSchema>,
  explicitTableId?: string,
) {
  const tableId = explicitTableId ?? body.tableId;

  if (!tableId) {
    throw new ApiError(400, "tableId is required");
  }

  await getRecord(c.var.supabase, "table", tableId);

  const count = body.count ?? 1;
  if (count > 1 && body.idx !== undefined) {
    throw new ApiError(400, "idx cannot be used when count is greater than 1");
  }

  const rows =
    body.idx === undefined
      ? await createRecordsWithGeneratedIndex(
          c.var.supabase,
          "row",
          tableId,
          (startIndex) =>
            Array.from(
              {
                length: count,
              },
              (_, index) => ({
                idx: startIndex + index,
                table_id: tableId,
              }),
            ),
        )
      : await (() => {
          const explicitStartIndex = body.idx;

          return createRecords(
            c.var.supabase,
            "row",
            Array.from(
              {
                length: count,
              },
              (_, index) => ({
                idx: explicitStartIndex + index,
                table_id: tableId,
              }),
            ),
          );
        })();

  try {
    const columns = await listRecordsFromQuery(
      c.var.supabase,
      "column",
      {
        tableId,
      },
      {
        tableId: "table_id",
      },
    );
    const cells = await createRecords(
      c.var.supabase,
      "cell",
      rows.flatMap((row) =>
        columns.map((column) => ({
          column_id: column.id,
          row_id: row.id,
        })),
      ),
    );

    if (count === 1) {
      return {
        data: rows[0],
        location: `/rows/${rows[0].id}`,
      };
    }

    return {
      data: {
        cells,
        rows,
      },
      location: `/tables/${tableId}/rows`,
    };
  } catch (handlerError) {
    const rowIds = rows.map((row) => row.id);
    await deleteRecordsInColumn(c.var.supabase, "cell", "row_id", rowIds);
    await deleteRecordsInColumn(c.var.supabase, "row", "id", rowIds);
    throw handlerError;
  }
}

export function mountRowResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) => createRows(c, body),
        schema: rowCreateSchema,
      },
      list: {
        handler: (c, query) =>
          listRecordsFromQuery(
            c.var.supabase,
            "row",
            query,
            {
              tableId: "table_id",
            },
            [
              {
                column: "table_id",
              },
              {
                column: "idx",
              },
            ],
          ),
        schema: rowListSchema,
      },
      path: "/rows",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          await getRecord(c.var.supabase, "row", id);
          const cells = await listRecordsFromQuery(
            c.var.supabase,
            "cell",
            {
              rowId: id,
            },
            {
              rowId: "row_id",
            },
          );
          await deleteProgramRunsForCellIds(
            c.var.supabase,
            cells.map((cell) => cell.id),
          );

          await Promise.all([
            deleteRecordsByColumn(c.var.supabase, "cell", "row_id", id),
            deleteRecord(c.var.supabase, "row", id),
          ]);

          return successResponse();
        },
      },
      get: {
        handler: (c, id) => getRecord(c.var.supabase, "row", id),
      },
      idParam: "rowId",
      patch: {
        handler: async (c, id, body) => {
          await getRecord(c.var.supabase, "row", id);
          requireAnyDefined([
            body.idx,
          ]);

          return updateRecord(c.var.supabase, "row", id, {
            idx: body.idx,
          });
        },
        schema: rowPatchSchema,
      },
      path: "/rows/:rowId",
    },
  });

  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) => createRows(c, body, requiredParam(c, "tableId")),
        schema: rowCreateSchema,
      },
      list: {
        handler: async (c) => {
          const tableId = requiredParam(c, "tableId");
          await getRecord(c.var.supabase, "table", tableId);

          return listRecordsFromQuery(
            c.var.supabase,
            "row",
            {
              tableId,
            },
            {
              tableId: "table_id",
            },
            [
              {
                column: "idx",
              },
            ],
          );
        },
      },
      path: "/tables/:tableId/rows",
    },
  });
}
