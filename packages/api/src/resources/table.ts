import type { SupabaseClient } from "@marble/supabase";
import type { Hono } from "hono";
import { type ApiEnv, mountResource, requireAnyDefined } from "../core";
import {
  createRecord,
  deleteRecord,
  deleteRecordsInColumn,
  getRecord,
  listRecords,
  listRecordsFromQuery,
  listRecordsInColumn,
  successResponse,
  updateRecord,
} from "../data";
import { deleteColumnDependenciesForColumnIds } from "./column";
import { resolveOwnerProfileId } from "./profile";
import { deleteProgramRunsForCellIds } from "./program_run";
import { nonEmptyStringSchema, requestObject, uuidSchema } from "./shared";

const tableListSchema = requestObject({
  ownerProfileId: uuidSchema.optional(),
});

const tableWriteSchema = requestObject({
  name: nonEmptyStringSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

export async function deleteTableCascade(
  supabase: SupabaseClient,
  tableId: string,
) {
  await getRecord(supabase, "table", tableId);

  const [columns, rows] = await Promise.all([
    listRecords(supabase, "column", {
      table_id: tableId,
    }),
    listRecords(supabase, "row", {
      table_id: tableId,
    }),
  ]);
  const columnIds = columns.map((column) => column.id);
  const rowIds = rows.map((row) => row.id);
  const cells = await listRecordsInColumn(supabase, "cell", "row_id", rowIds);

  await deleteProgramRunsForCellIds(
    supabase,
    cells.map((cell) => cell.id),
  );
  await deleteColumnDependenciesForColumnIds(supabase, columnIds);

  await Promise.all([
    deleteRecordsInColumn(supabase, "cell", "row_id", rowIds),
    deleteRecordsInColumn(supabase, "column", "id", columnIds),
    deleteRecordsInColumn(supabase, "row", "id", rowIds),
  ]);

  await deleteRecord(supabase, "table", tableId);
}

export function mountTableResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: async (c, body) => {
          const ownerProfileId = await resolveOwnerProfileId(
            c.var.supabase,
            body.ownerProfileId,
          );
          const data = await createRecord(c.var.supabase, "table", {
            name: body.name ?? "Untitled Table",
            owner_profile_id: ownerProfileId,
          });

          return {
            data,
            location: `/tables/${data.id}`,
          };
        },
        schema: tableWriteSchema,
      },
      list: {
        handler: (c, query) =>
          listRecordsFromQuery(
            c.var.supabase,
            "table",
            query,
            {
              ownerProfileId: "owner_profile_id",
            },
            [
              {
                column: "created_at",
              },
            ],
          ),
        schema: tableListSchema,
      },
      path: "/tables",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          await deleteTableCascade(c.var.supabase, id);
          return successResponse();
        },
      },
      get: {
        handler: (c, id) => getRecord(c.var.supabase, "table", id),
      },
      idParam: "tableId",
      patch: {
        handler: async (c, id, body) => {
          await getRecord(c.var.supabase, "table", id);
          requireAnyDefined([
            body.name,
            body.ownerProfileId,
          ]);

          if (body.ownerProfileId) {
            await getRecord(c.var.supabase, "profile", body.ownerProfileId);
          }

          return updateRecord(c.var.supabase, "table", id, {
            name: body.name,
            owner_profile_id: body.ownerProfileId,
          });
        },
        schema: tableWriteSchema,
      },
      path: "/tables/:tableId",
    },
  });
}
