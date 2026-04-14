import type { SupabaseClient } from "@marble/supabase";
import type { Hono } from "hono";
import {
  type ApiContext,
  type ApiEnv,
  ApiError,
  mountResource,
  requireAnyDefined,
  requiredParam,
} from "../core";
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
import {
  listAccessibleProjectIds,
  requireAccessibleProject,
  requireAccessibleTable,
} from "./access";
import { deleteColumnDependenciesForColumnIds } from "./column";
import { deleteProgramRunsForCellIds } from "./program_run";
import { nonEmptyStringSchema, requestObject, uuidSchema } from "./shared";

const tableListSchema = requestObject({
  projectId: uuidSchema.optional(),
});

const tableWriteSchema = requestObject({
  name: nonEmptyStringSchema.optional(),
  projectId: uuidSchema.optional(),
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

async function createTable(
  c: ApiContext,
  body: {
    name?: string;
    projectId?: string;
  },
  explicitProjectId?: string,
) {
  const projectId = explicitProjectId ?? body.projectId;

  if (!projectId) {
    throw new ApiError(400, "projectId is required");
  }

  await requireAccessibleProject(c.var.supabase, {
    authenticatedProfileId: c.var.auth?.profileId,
    projectId,
    userId: c.var.auth?.userId,
  });

  const data = await createRecord(c.var.supabase, "table", {
    name: body.name ?? "Untitled Table",
    project_id: projectId,
  });

  return {
    data,
    location: `/tables/${data.id}`,
  };
}

export function mountTableResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) => createTable(c, body),
        schema: tableWriteSchema,
      },
      list: {
        handler: async (c, query) => {
          if (query.projectId) {
            await requireAccessibleProject(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              projectId: query.projectId,
              userId: c.var.auth?.userId,
            });

            return listRecordsFromQuery(
              c.var.supabase,
              "table",
              {
                projectId: query.projectId,
              },
              {
                projectId: "project_id",
              },
              [
                {
                  column: "created_at",
                },
              ],
            );
          }

          const accessibleProjectIds = await listAccessibleProjectIds(
            c.var.supabase,
            {
              authenticatedProfileId: c.var.auth?.profileId,
              userId: c.var.auth?.userId,
            },
          );

          if (accessibleProjectIds !== undefined) {
            if (accessibleProjectIds.length === 0) {
              return [];
            }

            return listRecordsInColumn(
              c.var.supabase,
              "table",
              "project_id",
              accessibleProjectIds,
              [
                {
                  column: "created_at",
                },
              ],
            );
          }

          return listRecords(c.var.supabase, "table", {}, [
            {
              column: "created_at",
            },
          ]);
        },
        schema: tableListSchema,
      },
      path: "/tables",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          await requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId: id,
            userId: c.var.auth?.userId,
          });
          await deleteTableCascade(c.var.supabase, id);
          return successResponse();
        },
      },
      get: {
        handler: (c, id) =>
          requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId: id,
            userId: c.var.auth?.userId,
          }),
      },
      idParam: "tableId",
      patch: {
        handler: async (c, id, body) => {
          await requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId: id,
            userId: c.var.auth?.userId,
          });
          requireAnyDefined([
            body.name,
            body.projectId,
          ]);

          return updateRecord(c.var.supabase, "table", id, {
            name: body.name,
            project_id:
              body.projectId === undefined
                ? undefined
                : (
                    await requireAccessibleProject(c.var.supabase, {
                      authenticatedProfileId: c.var.auth?.profileId,
                      projectId: body.projectId,
                      userId: c.var.auth?.userId,
                    })
                  ).id,
          });
        },
        schema: tableWriteSchema,
      },
      path: "/tables/:tableId",
    },
  });

  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) =>
          createTable(c, body, requiredParam(c, "projectId")),
        schema: tableWriteSchema,
      },
      list: {
        handler: async (c) => {
          const projectId = requiredParam(c, "projectId");
          await requireAccessibleProject(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            projectId,
            userId: c.var.auth?.userId,
          });

          return listRecordsFromQuery(
            c.var.supabase,
            "table",
            {
              projectId,
            },
            {
              projectId: "project_id",
            },
            [
              {
                column: "created_at",
              },
            ],
          );
        },
      },
      path: "/projects/:projectId/tables",
    },
  });
}
