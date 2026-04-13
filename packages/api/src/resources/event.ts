import type { Hono } from "hono";
import { type ApiEnv, mountResource } from "../core";
import { getRecord, listRecordsFromQuery } from "../data";
import {
  dataOperationSchema,
  nonEmptyStringSchema,
  requestObject,
  uuidSchema,
} from "./shared";

const eventListSchema = requestObject({
  entityId: uuidSchema.optional(),
  operation: dataOperationSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
  resource: nonEmptyStringSchema.optional(),
});

export function mountEventResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      list: {
        handler: (c, query) =>
          listRecordsFromQuery(
            c.var.supabase,
            "event",
            query,
            {
              entityId: "entity_id",
              operation: "operation",
              ownerProfileId: "owner_profile_id",
              resource: "resource",
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
