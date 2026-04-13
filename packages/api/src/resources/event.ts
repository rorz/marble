import type { Hono } from "hono";
import { type ApiEnv, mountResource } from "../core";
import { getRecord, listRecordsFromQuery } from "../data";
import { resolveOwnerProfileFilter } from "./profile";
import {
  dataOperationSchema,
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
  recordOwnerProfileId: uuidSchema.optional(),
  requestId: nonEmptyStringSchema.optional(),
  resource: nonEmptyStringSchema.optional(),
  source: nonEmptyStringSchema.optional(),
});

export function mountEventResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      list: {
        handler: (c, query) =>
          listRecordsFromQuery(
            c.var.supabase,
            "event",
            {
              ...query,
              actorProfileId: resolveOwnerProfileFilter({
                authenticatedProfileId: c.var.auth?.profileId,
                ownerProfileId: query.actorProfileId ?? query.ownerProfileId,
              }),
              ownerProfileId: undefined,
            },
            {
              actorKeyId: "actor_key_id",
              actorProfileId: "actor_profile_id",
              entityId: "entity_id",
              operation: "operation",
              ownerProfileId: "actor_profile_id",
              recordOwnerProfileId: "record_owner_profile_id",
              requestId: "request_id",
              resource: "resource",
              source: "source",
            },
            [
              {
                ascending: false,
                column: "created_at",
              },
            ],
          ),
        schema: eventListSchema,
      },
      path: "/events",
    },
    item: {
      get: {
        handler: (c, id) => getRecord(c.var.supabase, "event", id),
      },
      idParam: "eventId",
      path: "/events/:eventId",
    },
  });
}
