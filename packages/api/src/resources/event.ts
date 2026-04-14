import type { Hono } from "hono";
import { type ApiEnv, ApiError, mountResource } from "../core";
import { getRecord } from "../data";
import { listAccessibleOwnerProfileIds } from "./access";
import { requireAccessibleProfile } from "./profile";
import {
  dataOperationSchema,
  eventSourceSchema,
  nonEmptyStringSchema,
  requestObject,
  uuidSchema,
} from "./shared";

const eventListSchema = requestObject({
  actorKeyId: uuidSchema.optional(),
  actorProfileId: uuidSchema.optional(),
  entityId: uuidSchema.optional(),
  operation: dataOperationSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
  requestId: nonEmptyStringSchema.optional(),
  resource: nonEmptyStringSchema.optional(),
  source: eventSourceSchema.optional(),
});

export function mountEventResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      list: {
        handler: async (c, query) => {
          const requestedActorProfileId =
            query.actorProfileId ?? query.ownerProfileId;
          const accessibleOwnerProfileIds = await listAccessibleOwnerProfileIds(
            c.var.supabase,
            {
              authenticatedProfileId: c.var.auth?.profileId,
              userId: c.var.auth?.userId,
            },
          );

          let request = c.var.supabase.from("event").select("*");

          if (accessibleOwnerProfileIds !== undefined) {
            if (
              requestedActorProfileId &&
              !accessibleOwnerProfileIds.includes(requestedActorProfileId)
            ) {
              return [];
            }

            const scopedProfileIds = requestedActorProfileId
              ? [
                  requestedActorProfileId,
                ]
              : accessibleOwnerProfileIds;

            if (scopedProfileIds.length === 0) {
              return [];
            }

            request = request.in("actor_profile_id", scopedProfileIds);
          } else if (requestedActorProfileId) {
            request = request.eq("actor_profile_id", requestedActorProfileId);
          }

          if (query.actorKeyId) {
            request = request.eq("actor_key_id", query.actorKeyId);
          }

          if (query.entityId) {
            request = request.eq("entity_id", query.entityId);
          }

          if (query.operation) {
            request = request.eq("operation", query.operation);
          }

          if (query.requestId) {
            request = request.eq("request_id", query.requestId);
          }

          if (query.resource) {
            request = request.eq("resource", query.resource);
          }

          if (query.source) {
            request = request.eq("source", query.source);
          }

          const { data, error } = await request.order("created_at", {
            ascending: false,
          });

          if (error) {
            throw new ApiError(500, error.message);
          }

          return data ?? [];
        },
        schema: eventListSchema,
      },
      path: "/events",
    },
    item: {
      get: {
        handler: async (c, id) => {
          const event = await getRecord(c.var.supabase, "event", id);
          await requireAccessibleProfile(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.userId
              ? undefined
              : c.var.auth?.profileId,
            profileId: event.actor_profile_id,
            userId: c.var.auth?.userId,
          });
          return event;
        },
      },
      idParam: "eventId",
      path: "/events/:eventId",
    },
  });
}
