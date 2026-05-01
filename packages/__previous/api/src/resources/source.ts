import { Schemas } from "@marble/old-core";
import type { Database, Json } from "@marble/supabase";
import type { Hono } from "hono";
import { z } from "zod";
import {
  type ApiContext,
  type ApiEnv,
  ApiError,
  mountResource,
  requireAnyDefined,
  requiredParam,
  zodError,
} from "../core";
import {
  createRecord,
  deleteRecord,
  listRecords,
  listRecordsFromQuery,
  listRecordsInColumn,
  type OrderSpec,
  successResponse,
  updateRecord,
} from "../data";
import {
  listAccessibleProjectIds,
  requireAccessibleProject,
  requireAccessibleSource,
} from "./access";
import {
  jsonValueSchema,
  nonEmptyStringSchema,
  requestObject,
  uuidSchema,
} from "./shared";

const DEFAULT_SOURCE_PAYLOAD_SCHEMA = {
  type: "object",
} as const satisfies Json;

const CREATED_AT_DESC_ORDER: OrderSpec[] = [
  {
    ascending: false,
    column: "created_at",
  },
];

const sourceListSchema = requestObject({
  projectId: uuidSchema.optional(),
});

const sourceWriteSchema = requestObject({
  name: nonEmptyStringSchema.optional(),
  payloadSchema: jsonValueSchema.optional(),
  projectId: uuidSchema.optional(),
});
type SourceRow = Database["public"]["Tables"]["source"]["Row"];

function normalizePayloadSchema(payloadSchema: unknown): Json {
  const parsedSchema = Schemas.ProgramInputSchema.safeParse(payloadSchema);

  if (!parsedSchema.success) {
    throw zodError(parsedSchema.error);
  }

  if (
    !parsedSchema.data ||
    typeof parsedSchema.data !== "object" ||
    Array.isArray(parsedSchema.data)
  ) {
    throw new ApiError(400, "payloadSchema must be a JSON schema object");
  }

  try {
    z.fromJSONSchema(parsedSchema.data);
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error
        ? `payloadSchema could not be compiled: ${error.message}`
        : "payloadSchema could not be compiled",
    );
  }

  return parsedSchema.data as Json;
}

function serializeSource(c: ApiContext, source: SourceRow) {
  const webhookBaseUrl = c.var.runtime.ingestor?.url ?? null;

  return {
    ...source,
    webhookUrl:
      webhookBaseUrl === null
        ? null
        : `${webhookBaseUrl}/webhooks/${source.id}`,
  };
}

function serializeSources(c: ApiContext, sources: SourceRow[]) {
  return sources.map((source) => serializeSource(c, source));
}

async function createSource(
  c: ApiContext,
  body: z.infer<typeof sourceWriteSchema>,
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

  const source = await createRecord(c.var.supabase, "source", {
    name: body.name ?? "Untitled Source",
    payload_schema:
      body.payloadSchema === undefined
        ? DEFAULT_SOURCE_PAYLOAD_SCHEMA
        : normalizePayloadSchema(body.payloadSchema),
    project_id: projectId,
  });

  return {
    data: serializeSource(c, source),
    location: `/sources/${source.id}`,
  };
}

export function mountSourceResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) => createSource(c, body),
        schema: sourceWriteSchema,
      },
      list: {
        handler: async (c, query) => {
          if (query.projectId) {
            await requireAccessibleProject(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              projectId: query.projectId,
              userId: c.var.auth?.userId,
            });

            return serializeSources(
              c,
              (await listRecordsFromQuery(
                c.var.supabase,
                "source",
                {
                  projectId: query.projectId,
                },
                {
                  projectId: "project_id",
                },
                CREATED_AT_DESC_ORDER,
              )) as SourceRow[],
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

            return serializeSources(
              c,
              (await listRecordsInColumn(
                c.var.supabase,
                "source",
                "project_id",
                accessibleProjectIds,
                CREATED_AT_DESC_ORDER,
              )) as SourceRow[],
            );
          }

          return serializeSources(
            c,
            (await listRecords(
              c.var.supabase,
              "source",
              {},
              CREATED_AT_DESC_ORDER,
            )) as SourceRow[],
          );
        },
        schema: sourceListSchema,
      },
      path: "/sources",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          await requireAccessibleSource(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            sourceId: id,
            userId: c.var.auth?.userId,
          });

          await deleteRecord(c.var.supabase, "source", id);
          return successResponse();
        },
      },
      get: {
        handler: async (c, id) =>
          serializeSource(
            c,
            (await requireAccessibleSource(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              sourceId: id,
              userId: c.var.auth?.userId,
            })) as SourceRow,
          ),
      },
      idParam: "sourceId",
      patch: {
        handler: async (c, id, body) => {
          const existing = await requireAccessibleSource(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            sourceId: id,
            userId: c.var.auth?.userId,
          });

          requireAnyDefined([
            body.name,
            body.payloadSchema,
          ]);

          return serializeSource(
            c,
            (await updateRecord(
              c.var.supabase,
              "source",
              id,
              {
                name: body.name,
                payload_schema:
                  body.payloadSchema === undefined
                    ? undefined
                    : normalizePayloadSchema(body.payloadSchema),
              },
              {
                before: existing,
              },
            )) as SourceRow,
          );
        },
        schema: sourceWriteSchema,
      },
      path: "/sources/:sourceId",
    },
  });

  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) =>
          createSource(c, body, requiredParam(c, "projectId")),
        schema: sourceWriteSchema,
      },
      list: {
        handler: async (c) => {
          const projectId = requiredParam(c, "projectId");
          await requireAccessibleProject(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            projectId,
            userId: c.var.auth?.userId,
          });

          return serializeSources(
            c,
            (await listRecordsFromQuery(
              c.var.supabase,
              "source",
              {
                projectId,
              },
              {
                projectId: "project_id",
              },
              CREATED_AT_DESC_ORDER,
            )) as SourceRow[],
          );
        },
      },
      path: "/projects/:projectId/sources",
    },
  });
}
