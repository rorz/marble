import type { Json } from "@marble/supabase";
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
  createRecord,
  type DbRow,
  deleteRecord,
  listRecordsFromQuery,
  listRecordsInColumn,
  type OrderSpec,
  successResponse,
  updateRecord,
} from "../data";
import {
  listAccessibleSourceIds,
  requireAccessiblePipe,
  requireAccessibleProject,
  requireAccessibleSource,
  requireAccessibleTable,
} from "./access";
import { nonEmptyStringSchema, requestObject, uuidSchema } from "./shared";

const CREATED_AT_DESC_ORDER: OrderSpec[] = [
  {
    ascending: false,
    column: "created_at",
  },
];

const pipeMappingSchema = requestObject({
  columnId: uuidSchema,
  jsonPath: nonEmptyStringSchema,
});

const pipeCreateSchema = requestObject({
  mappings: z.array(pipeMappingSchema).optional(),
  sourceId: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

const pipePatchSchema = requestObject({
  mappings: z.array(pipeMappingSchema).optional(),
  sourceId: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

const pipeListSchema = requestObject({
  projectId: uuidSchema.optional(),
  sourceId: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

function hasAllowManualInput(outputConfig: unknown) {
  if (!outputConfig || typeof outputConfig !== "object") {
    return false;
  }

  const flags = (
    outputConfig as {
      flags?: {
        allowManualInput?: boolean;
      };
    }
  ).flags;

  return flags?.allowManualInput === true;
}

async function listInputEligibleColumnsForTable(
  c: ApiContext,
  tableId: string,
): Promise<DbRow<"column">[]> {
  const columns = await listRecordsFromQuery(
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

  const programVersionIds = Array.from(
    new Set(columns.map((column) => column.program_version_id)),
  );

  if (programVersionIds.length === 0) {
    return [];
  }

  const programVersions = await listRecordsInColumn(
    c.var.supabase,
    "program_version",
    "id",
    programVersionIds,
  );
  const programVersionById = new Map(
    programVersions.map((programVersion) => [
      programVersion.id,
      programVersion,
    ]),
  );

  return columns.filter((column) =>
    hasAllowManualInput(
      programVersionById.get(column.program_version_id)?.output_config,
    ),
  );
}

async function normalizeMappings(
  c: ApiContext,
  tableId: string,
  mappings: z.infer<typeof pipeMappingSchema>[],
) {
  const eligibleColumns = await listInputEligibleColumnsForTable(c, tableId);
  const eligibleColumnIds = new Set(eligibleColumns.map((column) => column.id));
  const seenColumnIds = new Set<string>();

  for (const mapping of mappings) {
    if (seenColumnIds.has(mapping.columnId)) {
      throw new ApiError(
        400,
        `Pipe mappings cannot target the same column twice: ${mapping.columnId}`,
      );
    }

    seenColumnIds.add(mapping.columnId);

    if (!eligibleColumnIds.has(mapping.columnId)) {
      throw new ApiError(
        400,
        `Column ${mapping.columnId} is not an input-eligible column on table ${tableId}`,
      );
    }
  }

  return mappings as unknown as Json;
}

async function resolvePipeScope(
  c: ApiContext,
  input: {
    sourceId?: string;
    tableId?: string;
  },
  explicitProjectId?: string,
) {
  if (!input.sourceId) {
    throw new ApiError(400, "sourceId is required");
  }

  if (!input.tableId) {
    throw new ApiError(400, "tableId is required");
  }

  const [source, table] = await Promise.all([
    requireAccessibleSource(c.var.supabase, {
      authenticatedProfileId: c.var.auth?.profileId,
      sourceId: input.sourceId,
      userId: c.var.auth?.userId,
    }),
    requireAccessibleTable(c.var.supabase, {
      authenticatedProfileId: c.var.auth?.profileId,
      tableId: input.tableId,
      userId: c.var.auth?.userId,
    }),
  ]);

  if (source.project_id !== table.project_id) {
    throw new ApiError(
      400,
      "Pipe source and table must belong to the same project",
    );
  }

  if (explicitProjectId && source.project_id !== explicitProjectId) {
    throw new ApiError(
      400,
      "Pipe source and table must belong to the requested project",
    );
  }

  return {
    projectId: source.project_id,
    source,
    table,
  };
}

async function createPipe(
  c: ApiContext,
  body: z.infer<typeof pipeCreateSchema>,
  explicitProjectId?: string,
) {
  const { source, table } = await resolvePipeScope(
    c,
    {
      sourceId: body.sourceId,
      tableId: body.tableId,
    },
    explicitProjectId,
  );
  const mappings = await normalizeMappings(c, table.id, body.mappings ?? []);

  const pipe = await createRecord(c.var.supabase, "pipe", {
    mappings,
    source_id: source.id,
    table_id: table.id,
  });

  return {
    data: pipe,
    location: `/pipes/${pipe.id}`,
  };
}

export function mountPipeResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) => createPipe(c, body),
        schema: pipeCreateSchema,
      },
      list: {
        handler: async (c, query) => {
          let request = c.var.supabase.from("pipe").select("*");

          if (query.projectId) {
            await requireAccessibleProject(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              projectId: query.projectId,
              userId: c.var.auth?.userId,
            });
          }

          if (query.sourceId) {
            const source = await requireAccessibleSource(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              sourceId: query.sourceId,
              userId: c.var.auth?.userId,
            });

            if (query.projectId && source.project_id !== query.projectId) {
              return [];
            }

            request = request.eq("source_id", query.sourceId);
          } else if (query.projectId) {
            const projectSources = await listRecordsFromQuery(
              c.var.supabase,
              "source",
              {
                projectId: query.projectId,
              },
              {
                projectId: "project_id",
              },
            );

            if (projectSources.length === 0) {
              return [];
            }

            request = request.in(
              "source_id",
              projectSources.map((source) => source.id),
            );
          } else {
            const accessibleSourceIds = await listAccessibleSourceIds(
              c.var.supabase,
              {
                authenticatedProfileId: c.var.auth?.profileId,
                userId: c.var.auth?.userId,
              },
            );

            if (accessibleSourceIds !== undefined) {
              if (accessibleSourceIds.length === 0) {
                return [];
              }

              request = request.in("source_id", accessibleSourceIds);
            }
          }

          if (query.tableId) {
            const table = await requireAccessibleTable(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              tableId: query.tableId,
              userId: c.var.auth?.userId,
            });

            if (query.projectId && table.project_id !== query.projectId) {
              return [];
            }

            request = request.eq("table_id", query.tableId);
          }

          const { data, error } = await request.order("created_at", {
            ascending: false,
          });

          if (error) {
            throw new ApiError(500, error.message);
          }

          return data ?? [];
        },
        schema: pipeListSchema,
      },
      path: "/pipes",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          await requireAccessiblePipe(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            pipeId: id,
            userId: c.var.auth?.userId,
          });

          await deleteRecord(c.var.supabase, "pipe", id);
          return successResponse();
        },
      },
      get: {
        handler: (c, id) =>
          requireAccessiblePipe(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            pipeId: id,
            userId: c.var.auth?.userId,
          }),
      },
      idParam: "pipeId",
      patch: {
        handler: async (c, id, body) => {
          const existing = await requireAccessiblePipe(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            pipeId: id,
            userId: c.var.auth?.userId,
          });

          requireAnyDefined([
            body.mappings,
            body.sourceId,
            body.tableId,
          ]);

          const nextSourceId = body.sourceId ?? existing.source_id;
          const nextTableId = body.tableId ?? existing.table_id;
          const scope = await resolvePipeScope(c, {
            sourceId: nextSourceId,
            tableId: nextTableId,
          });

          return updateRecord(
            c.var.supabase,
            "pipe",
            id,
            {
              mappings:
                body.mappings === undefined
                  ? undefined
                  : await normalizeMappings(c, scope.table.id, body.mappings),
              source_id:
                body.sourceId === undefined ? undefined : scope.source.id,
              table_id: body.tableId === undefined ? undefined : scope.table.id,
            },
            {
              before: existing,
            },
          );
        },
        schema: pipePatchSchema,
      },
      path: "/pipes/:pipeId",
    },
  });

  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) =>
          createPipe(c, body, requiredParam(c, "projectId")),
        schema: pipeCreateSchema,
      },
      list: {
        handler: async (c) => {
          const projectId = requiredParam(c, "projectId");
          await requireAccessibleProject(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            projectId,
            userId: c.var.auth?.userId,
          });

          const sources = await listRecordsFromQuery(
            c.var.supabase,
            "source",
            {
              projectId,
            },
            {
              projectId: "project_id",
            },
          );

          if (sources.length === 0) {
            return [];
          }

          return listRecordsInColumn(
            c.var.supabase,
            "pipe",
            "source_id",
            sources.map((source) => source.id),
            CREATED_AT_DESC_ORDER,
          );
        },
      },
      path: "/projects/:projectId/pipes",
    },
  });
}
