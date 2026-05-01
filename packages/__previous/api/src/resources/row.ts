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
  createRecordsIgnoringDuplicates,
  createRecordsWithGeneratedIndex,
  deleteRecord,
  deleteRecordsByColumn,
  deleteRecordsInColumn,
  getRecord,
  listRecordsFromQuery,
  successResponse,
  updateRecord,
} from "../data";
import { listAccessibleTableIds, requireAccessibleTable } from "./access";
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

  await requireAccessibleTable(c.var.supabase, {
    authenticatedProfileId: c.var.auth?.profileId,
    tableId,
    userId: c.var.auth?.userId,
  });

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
    const cells = await createRecordsIgnoringDuplicates(
      c.var.supabase,
      "cell",
      rows.flatMap((row) =>
        columns.map((column) => ({
          column_id: column.id,
          row_id: row.id,
        })),
      ),
      "row_id,column_id",
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
        handler: async (c, query) => {
          let request = c.var.supabase.from("row").select("*");

          if (query.tableId) {
            await requireAccessibleTable(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              tableId: query.tableId,
              userId: c.var.auth?.userId,
            });
            request = request.eq("table_id", query.tableId);
          } else {
            const accessibleTableIds = await listAccessibleTableIds(
              c.var.supabase,
              {
                authenticatedProfileId: c.var.auth?.profileId,
                userId: c.var.auth?.userId,
              },
            );

            if (accessibleTableIds !== undefined) {
              if (accessibleTableIds.length === 0) {
                return [];
              }

              request = request.in("table_id", accessibleTableIds);
            }
          }

          const { data, error } = await request
            .order("table_id", {
              ascending: true,
            })
            .order("idx", {
              ascending: true,
            });

          if (error) {
            throw new ApiError(500, error.message);
          }

          return data ?? [];
        },
        schema: rowListSchema,
      },
      path: "/rows",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          const existing = await getRecord(c.var.supabase, "row", id);
          await requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId: existing.table_id,
            userId: c.var.auth?.userId,
          });
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
        handler: async (c, id) => {
          const row = await getRecord(c.var.supabase, "row", id);
          await requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId: row.table_id,
            userId: c.var.auth?.userId,
          });
          return row;
        },
      },
      idParam: "rowId",
      patch: {
        handler: async (c, id, body) => {
          const existing = await getRecord(c.var.supabase, "row", id);
          await requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId: existing.table_id,
            userId: c.var.auth?.userId,
          });
          requireAnyDefined([
            body.idx,
          ]);

          return updateRecord(
            c.var.supabase,
            "row",
            id,
            {
              idx: body.idx,
            },
            {
              before: existing,
            },
          );
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
          await requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId,
            userId: c.var.auth?.userId,
          });

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
