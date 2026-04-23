import type { Hono } from "hono";
import { z } from "zod";
import {
  type ApiContext,
  type ApiEnv,
  ApiError,
  mountResource,
  requiredParam,
} from "../core";
import {
  listAccessibleProjectIds,
  requireAccessibleProject,
  requireAccessibleSource,
  requireAccessibleSourceEvent,
} from "./access";
import { requestObject, uuidSchema } from "./shared";

const sourceEventListSchema = requestObject({
  limit: z.coerce.number().int().positive().max(200).optional(),
  projectId: uuidSchema.optional(),
  sourceId: uuidSchema.optional(),
});

async function listSourceEventsForQuery(
  appContext: ApiContext,
  input: z.infer<typeof sourceEventListSchema>,
) {
  const limit = input.limit ?? 50;
  let request = appContext.var.supabase.from("source_event").select("*");

  if (input.projectId) {
    await requireAccessibleProject(appContext.var.supabase, {
      authenticatedProfileId: appContext.var.auth?.profileId,
      projectId: input.projectId,
      userId: appContext.var.auth?.userId,
    });
    request = request.eq("project_id", input.projectId);
  } else if (input.sourceId === undefined) {
    const accessibleProjectIds = await listAccessibleProjectIds(
      appContext.var.supabase,
      {
        authenticatedProfileId: appContext.var.auth?.profileId,
        userId: appContext.var.auth?.userId,
      },
    );

    if (accessibleProjectIds !== undefined) {
      if (accessibleProjectIds.length === 0) {
        return [];
      }

      request = request.in("project_id", accessibleProjectIds);
    }
  }

  if (input.sourceId) {
    const source = await requireAccessibleSource(appContext.var.supabase, {
      authenticatedProfileId: appContext.var.auth?.profileId,
      sourceId: input.sourceId,
      userId: appContext.var.auth?.userId,
    });

    if (input.projectId && source.project_id !== input.projectId) {
      return [];
    }

    request = request.eq("source_id", input.sourceId);
  }

  const { data, error } = await request
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    throw new ApiError(500, error.message);
  }

  return data ?? [];
}

export function mountSourceEventResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      list: {
        handler: (c, query) => listSourceEventsForQuery(c, query),
        schema: sourceEventListSchema,
      },
      path: "/source-events",
    },
    item: {
      get: {
        handler: (c, id) =>
          requireAccessibleSourceEvent(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            sourceEventId: id,
            userId: c.var.auth?.userId,
          }),
      },
      idParam: "sourceEventId",
      path: "/source-events/:sourceEventId",
    },
  });

  mountResource(app, {
    collection: {
      list: {
        handler: (c, query) =>
          listSourceEventsForQuery(c, {
            ...query,
            sourceId: requiredParam(c, "sourceId"),
          }),
        schema: requestObject({
          limit: z.coerce.number().int().positive().max(200).optional(),
        }),
      },
      path: "/sources/:sourceId/events",
    },
  });
}
