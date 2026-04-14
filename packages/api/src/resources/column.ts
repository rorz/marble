import { Schemas } from "@marble/core";
import type { Json, SupabaseClient } from "@marble/supabase";
import type { Hono } from "hono";
import { z } from "zod";
import {
  type ApiContext,
  type ApiEnv,
  ApiError,
  hasAnyDefined,
  mountResource,
  requireAnyDefined,
  requiredParam,
} from "../core";
import {
  createRecord,
  createRecords,
  createRecordsIgnoringDuplicates,
  createRecordsWithGeneratedIndex,
  type DbRow,
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
import { resolveProgramVersionId } from "./program_version";
import {
  jsonValueSchema,
  nonEmptyStringSchema,
  requestObject,
  uuidSchema,
} from "./shared";

const columnListSchema = requestObject({
  programId: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

const columnWriteSchema = requestObject({
  idx: z.number().int().nonnegative().optional(),
  inputTemplate: z.string().optional(),
  name: nonEmptyStringSchema,
  outputSchema: jsonValueSchema.optional(),
  programId: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

const columnPatchSchema = requestObject({
  idx: z.number().int().nonnegative().optional(),
  inputTemplate: z.string().optional(),
  name: nonEmptyStringSchema.optional(),
  outputSchema: jsonValueSchema.optional(),
  programId: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
});

function resolveBaseOutputSchema(programVersion: DbRow<"program_version">) {
  const parsed = Schemas.ProgramOutputConfig.safeParse(
    programVersion.output_config,
  );

  if (!parsed.success) {
    return {};
  }

  return parsed.data.schema;
}

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
  supabase: SupabaseClient,
  columnId: string,
  inputTemplate: string,
) {
  const sourceColumnIds = extractDependenciesFromTemplate(inputTemplate);
  await deleteRecordsByColumn(
    supabase,
    "column_dependency",
    "target_column_id",
    columnId,
  );

  if (sourceColumnIds.length === 0) {
    return [] as DbRow<"column_dependency">[];
  }

  return createRecords(
    supabase,
    "column_dependency",
    sourceColumnIds.map((sourceColumnId) => ({
      source_column_id: sourceColumnId,
      target_column_id: columnId,
    })),
  );
}

export function deleteColumnDependenciesForColumnIds(
  supabase: SupabaseClient,
  columnIds: string[],
) {
  return Promise.all([
    deleteRecordsInColumn(
      supabase,
      "column_dependency",
      "source_column_id",
      columnIds,
    ),
    deleteRecordsInColumn(
      supabase,
      "column_dependency",
      "target_column_id",
      columnIds,
    ),
  ]).then(() => undefined);
}

async function createColumn(
  c: ApiContext,
  body: z.infer<typeof columnWriteSchema>,
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

  const programVersionId = await resolveProgramVersionId(c.var.supabase, {
    programId: body.programId,
    programVersionId: body.programVersionId,
  });
  const programVersion = await getRecord(
    c.var.supabase,
    "program_version",
    programVersionId,
  );
  const inputTemplate = body.inputTemplate ?? "{}";
  const outputSchema =
    body.outputSchema ?? resolveBaseOutputSchema(programVersion);
  const parsedOutputSchema = Schemas.ColumnOutputSchema.safeParse(outputSchema);

  if (!parsedOutputSchema.success) {
    throw new ApiError(400, "Invalid request", parsedOutputSchema.error.issues);
  }

  const column =
    body.idx === undefined
      ? (
          await createRecordsWithGeneratedIndex(
            c.var.supabase,
            "column",
            tableId,
            (startIndex) => [
              {
                idx: startIndex,
                input_template: inputTemplate,
                name: body.name,
                output_schema: parsedOutputSchema.data as Json,
                program_version_id: programVersionId,
                table_id: tableId,
              },
            ],
          )
        )[0]
      : await createRecord(c.var.supabase, "column", {
          idx: body.idx,
          input_template: inputTemplate,
          name: body.name,
          output_schema: parsedOutputSchema.data as Json,
          program_version_id: programVersionId,
          table_id: tableId,
        });

  try {
    const dependencies = await replaceColumnDependencies(
      c.var.supabase,
      column.id,
      inputTemplate,
    );
    const rows = await listRecordsFromQuery(
      c.var.supabase,
      "row",
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
      rows.map((row) => ({
        column_id: column.id,
        row_id: row.id,
      })),
      "row_id,column_id",
    );

    return {
      data: {
        ...column,
        cells,
        dependencies,
      },
      location: `/columns/${column.id}`,
    };
  } catch (handlerError) {
    await deleteRecordsByColumn(c.var.supabase, "cell", "column_id", column.id);
    await deleteColumnDependenciesForColumnIds(c.var.supabase, [
      column.id,
    ]);
    await deleteRecord(c.var.supabase, "column", column.id);
    throw handlerError;
  }
}

export function mountColumnResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) => createColumn(c, body),
        schema: columnWriteSchema,
      },
      list: {
        handler: async (c, query) => {
          let request = c.var.supabase.from("column").select("*");

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

          if (query.programVersionId) {
            request = request.eq("program_version_id", query.programVersionId);
          } else if (query.programId) {
            request = request.eq(
              "program_version_id",
              await resolveProgramVersionId(c.var.supabase, {
                programId: query.programId,
              }),
            );
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
        schema: columnListSchema,
      },
      path: "/columns",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          const existing = await getRecord(c.var.supabase, "column", id);
          await requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId: existing.table_id,
            userId: c.var.auth?.userId,
          });
          const cells = await listRecordsFromQuery(
            c.var.supabase,
            "cell",
            {
              columnId: id,
            },
            {
              columnId: "column_id",
            },
          );
          await deleteProgramRunsForCellIds(
            c.var.supabase,
            cells.map((cell) => cell.id),
          );

          await Promise.all([
            deleteRecordsByColumn(c.var.supabase, "cell", "column_id", id),
            deleteRecord(c.var.supabase, "column", id),
            deleteColumnDependenciesForColumnIds(c.var.supabase, [
              id,
            ]),
          ]);

          return successResponse();
        },
      },
      get: {
        handler: async (c, id) => {
          const column = await getRecord(c.var.supabase, "column", id);
          await requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId: column.table_id,
            userId: c.var.auth?.userId,
          });
          return column;
        },
      },
      idParam: "columnId",
      patch: {
        handler: async (c, id, body) => {
          const existing = await getRecord(c.var.supabase, "column", id);
          await requireAccessibleTable(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            tableId: existing.table_id,
            userId: c.var.auth?.userId,
          });
          requireAnyDefined([
            body.idx,
            body.inputTemplate,
            body.name,
            body.outputSchema,
            body.programId,
            body.programVersionId,
          ]);

          const inputTemplate = body.inputTemplate;
          const programVersionId = hasAnyDefined([
            body.programId,
            body.programVersionId,
          ])
            ? await resolveProgramVersionId(c.var.supabase, {
                programId: body.programId,
                programVersionId: body.programVersionId,
              })
            : existing.program_version_id;

          const outputSchema =
            body.outputSchema ??
            resolveBaseOutputSchema(
              await getRecord(
                c.var.supabase,
                "program_version",
                programVersionId,
              ),
            );
          const parsedOutputSchema =
            Schemas.ColumnOutputSchema.safeParse(outputSchema);

          if (!parsedOutputSchema.success) {
            throw new ApiError(
              400,
              "Invalid request",
              parsedOutputSchema.error.issues,
            );
          }

          const data = await updateRecord(c.var.supabase, "column", id, {
            idx: body.idx,
            input_template: inputTemplate,
            name: body.name,
            output_schema: parsedOutputSchema.data as Json,
            program_version_id: programVersionId,
          });

          if (inputTemplate !== undefined) {
            await replaceColumnDependencies(c.var.supabase, id, inputTemplate);
          }

          return data;
        },
        schema: columnPatchSchema,
      },
      path: "/columns/:columnId",
    },
  });

  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) =>
          createColumn(c, body, requiredParam(c, "tableId")),
        schema: columnWriteSchema,
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
            "column",
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
      path: "/tables/:tableId/columns",
    },
  });
}
