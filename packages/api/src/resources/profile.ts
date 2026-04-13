import type { SupabaseClient } from "@marble/supabase";
import type { Hono } from "hono";
import {
  type ApiEnv,
  ApiError,
  mountResource,
  requireAnyDefined,
} from "../core";
import { getRecord, listRecordsFromQuery, updateRecord } from "../data";
import {
  nonEmptyStringSchema,
  profileTypeSchema,
  requestObject,
  uuidSchema,
} from "./shared";

const profileListSchema = requestObject({
  ownerUserId: uuidSchema.optional(),
  type: profileTypeSchema.optional(),
});

const profileUpdateSchema = requestObject({
  externalName: nonEmptyStringSchema.nullable().optional(),
  name: nonEmptyStringSchema.optional(),
  type: profileTypeSchema.optional(),
});

export function mountProfileResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      list: {
        handler: (c, query) =>
          listRecordsFromQuery(
            c.var.supabase,
            "profile",
            query,
            {
              ownerUserId: "owner_user_id",
              type: "type",
            },
            [
              {
                column: "created_at",
              },
            ],
          ),
        schema: profileListSchema,
      },
      path: "/profiles",
    },
    item: {
      get: {
        handler: (c, id) => getRecord(c.var.supabase, "profile", id),
      },
      idParam: "profileId",
      patch: {
        handler: async (c, id, body) => {
          await getRecord(c.var.supabase, "profile", id);
          requireAnyDefined([
            body.externalName,
            body.name,
            body.type,
          ]);

          return updateRecord(c.var.supabase, "profile", id, {
            external_name: body.externalName,
            name: body.name,
            type: body.type,
          });
        },
        schema: profileUpdateSchema,
      },
      path: "/profiles/:profileId",
    },
  });
}

export async function resolveOwnerProfileId(
  supabase: SupabaseClient,
  ownerProfileId?: string,
) {
  if (ownerProfileId) {
    await getRecord(supabase, "profile", ownerProfileId);
    return ownerProfileId;
  }

  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .order("created_at", {
      ascending: true,
    })
    .limit(2);

  if (error) {
    throw new ApiError(500, error.message);
  }

  if (!data || data.length === 0) {
    throw new ApiError(
      400,
      "No profiles exist. Provide owner_profile_id explicitly.",
    );
  }

  if (data.length > 1) {
    throw new ApiError(
      400,
      "Multiple profiles exist. Provide owner_profile_id explicitly.",
    );
  }

  return data[0].id;
}
