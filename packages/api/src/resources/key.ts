import { apiKeyPreview, createApiKeyMaterial } from "@marble/keys";
import type { Hono } from "hono";
import { type ApiContext, type ApiEnv, ApiError, mountResource } from "../core";
import {
  createRecord,
  getRecord,
  successResponse,
  updateRecord,
} from "../data";
import { requireOwnedProfileForUser } from "./profile";
import { requestObject, uuidSchema } from "./shared";

const keyCreateSchema = requestObject({
  ownerProfileId: uuidSchema,
});

async function requireOwnedKeyForUser(c: ApiContext, keyId: string) {
  if (!c.var.auth?.userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const key = await getRecord(c.var.supabase, "key", keyId);
  await requireOwnedProfileForUser(c.var.supabase, {
    profileId: key.owner_profile_id,
    userId: c.var.auth.userId,
  });

  return key;
}

export function mountKeyResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: async (c, body) => {
          if (!c.var.auth?.userId) {
            throw new ApiError(401, "Unauthorized");
          }

          const profile = await requireOwnedProfileForUser(c.var.supabase, {
            profileId: body.ownerProfileId,
            userId: c.var.auth.userId,
          });
          const material = await createApiKeyMaterial();
          const key = await createRecord(c.var.supabase, "key", {
            hash: material.hash,
            owner_profile_id: profile.id,
            prefix: material.prefix,
          });

          return {
            data: {
              key: {
                created_at: key.created_at,
                deleted_at: key.deleted_at,
                id: key.id,
                owner_profile_id: key.owner_profile_id,
                prefix: key.prefix,
                preview: apiKeyPreview(key.prefix),
              },
              token: material.token,
            },
            location: `/keys/${key.id}`,
          };
        },
        schema: keyCreateSchema,
      },
      path: "/keys",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          const key = await requireOwnedKeyForUser(c, id);

          if (key.deleted_at) {
            throw new ApiError(409, "API key already revoked");
          }

          await updateRecord(c.var.supabase, "key", id, {
            deleted_at: new Date().toISOString(),
          });

          return successResponse();
        },
      },
      idParam: "keyId",
      path: "/keys/:keyId",
    },
  });
}
