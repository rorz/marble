import {
  apiKeyPreview,
  createApiKeyMaterial,
  listApiKeysForProfiles,
} from "@marble/keys";
import type { Hono } from "hono";
import { z } from "zod";
import { type ApiContext, type ApiEnv, ApiError, mountResource } from "../core";
import {
  createRecord,
  getRecord,
  listRecords,
  successResponse,
  updateRecord,
} from "../data";
import { requireOwnedProfileForUser } from "./profile";
import { requestObject, uuidSchema } from "./shared";

const booleanQuerySchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean().optional());

const keyListSchema = z.object({
  includeDeleted: booleanQuerySchema,
  ownerProfileId: uuidSchema.optional(),
});
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

function toKeyResponse(key: {
  created_at: string;
  deleted_at: null | string;
  id: string;
  owner_profile_id: string;
  prefix: string;
}) {
  return {
    created_at: key.created_at,
    deleted_at: key.deleted_at,
    id: key.id,
    owner_profile_id: key.owner_profile_id,
    prefix: key.prefix,
    preview: apiKeyPreview(key.prefix),
  };
}

async function requireAccessibleKey(c: ApiContext, keyId: string) {
  const key = await getRecord(c.var.supabase, "key", keyId);

  if (c.var.auth?.userId) {
    await requireOwnedProfileForUser(c.var.supabase, {
      profileId: key.owner_profile_id,
      userId: c.var.auth.userId,
    });

    return key;
  }

  if (!c.var.auth?.profileId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (key.owner_profile_id !== c.var.auth.profileId) {
    throw new ApiError(404, "API key not found");
  }

  return key;
}

async function resolveListOwnerProfileIds(
  c: ApiContext,
  ownerProfileId?: string,
) {
  if (c.var.auth?.userId) {
    if (ownerProfileId) {
      await requireOwnedProfileForUser(c.var.supabase, {
        profileId: ownerProfileId,
        userId: c.var.auth.userId,
      });

      return [
        ownerProfileId,
      ];
    }

    const profiles = await listRecords(
      c.var.supabase,
      "profile",
      {
        owner_user_id: c.var.auth.userId,
      },
      [
        {
          ascending: false,
          column: "created_at",
        },
      ],
    );

    return profiles.map((profile) => profile.id);
  }

  if (!c.var.auth?.profileId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (ownerProfileId && ownerProfileId !== c.var.auth.profileId) {
    throw new ApiError(
      403,
      "owner_profile_id filters must match the authenticated API key profile.",
    );
  }

  return [
    c.var.auth.profileId,
  ];
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
              key: toKeyResponse(key),
              token: material.token,
            },
            location: `/keys/${key.id}`,
          };
        },
        schema: keyCreateSchema,
      },
      list: {
        handler: async (c, query) => {
          const ownerProfileIds = await resolveListOwnerProfileIds(
            c,
            query.ownerProfileId,
          );
          const keys = await listApiKeysForProfiles(
            c.var.supabase,
            ownerProfileIds,
            {
              includeDeleted: query.includeDeleted,
            },
          );

          return keys.map((key) => toKeyResponse(key));
        },
        schema: keyListSchema,
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
      get: {
        handler: async (c, id) =>
          toKeyResponse(await requireAccessibleKey(c, id)),
      },
      idParam: "keyId",
      path: "/keys/:keyId",
    },
  });
}
