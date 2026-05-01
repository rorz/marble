import type { Tables } from "@marble/supabase";
import type { Hono } from "hono";
import { z } from "zod";
import {
  type ApiContext,
  type ApiEnv,
  ApiError,
  mountResource,
  requireAnyDefined,
} from "../core";
import { getRecord, successResponse } from "../data";
import { writeEventRecord } from "../event-driver";
import {
  nonEmptyStringSchema,
  requestObject,
  secretCategorySchema,
} from "./shared";

type SecretRow = Tables<"secret">;
type PublicSecretRow = Omit<SecretRow, "vault_secret_id">;

const ENVIRONMENT_VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const secretNameSchema = nonEmptyStringSchema.refine(
  (value) => ENVIRONMENT_VARIABLE_NAME_PATTERN.test(value),
  "Secret names must be valid environment variable names.",
);

const secretValueSchema = z.string().min(1, "Secret values must not be empty.");

const secretListSchema = requestObject({
  category: secretCategorySchema.optional(),
  name: secretNameSchema.optional(),
});

const secretCreateSchema = requestObject({
  category: secretCategorySchema.optional(),
  name: secretNameSchema,
  value: secretValueSchema,
});

const secretPatchSchema = requestObject({
  name: secretNameSchema.optional(),
  value: secretValueSchema.optional(),
});

function toPublicSecret(secret: SecretRow): PublicSecretRow {
  const { vault_secret_id: _vaultSecretId, ...publicSecret } = secret;
  return publicSecret;
}

function serviceRoleDb(c: ApiContext) {
  return c.var.serviceRoleSupabase;
}

async function resolveAuthenticatedOwnerUserId(c: ApiContext) {
  if (c.var.auth?.userId) {
    return c.var.auth.userId;
  }

  if (c.var.auth?.profileId) {
    const profile = await getRecord(
      c.var.supabase,
      "profile",
      c.var.auth.profileId,
    );
    return profile.owner_user_id;
  }

  throw new ApiError(401, "Unauthorized");
}

async function requireOwnedSecret(c: ApiContext, secretId: string) {
  const ownerUserId = await resolveAuthenticatedOwnerUserId(c);
  const secret = await getRecord(c.var.supabase, "secret", secretId);

  if (secret.owner_user_id !== ownerUserId) {
    throw new ApiError(404, "Secret not found");
  }

  return secret;
}

export function mountSecretResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: async (c, body) => {
          const ownerUserId = await resolveAuthenticatedOwnerUserId(c);
          const { data, error } = await serviceRoleDb(c).rpc(
            "secret_store_create",
            {
              p_category: body.category ?? "UserDefined",
              p_name: body.name,
              p_owner_user_id: ownerUserId,
              p_plaintext_value: body.value,
            },
          );

          if (error || !data) {
            throw new ApiError(
              500,
              error?.message ?? "Could not create secret",
            );
          }

          const secret = data as SecretRow;
          await writeEventRecord(c.var.supabase, {
            after: secret as Record<string, unknown>,
            before: null,
            operation: "Create",
            resource: "secret",
          });

          return {
            data: toPublicSecret(secret),
            location: `/secrets/${secret.id}`,
          };
        },
        schema: secretCreateSchema,
      },
      list: {
        handler: async (c, query) => {
          const ownerUserId = await resolveAuthenticatedOwnerUserId(c);
          let request = c.var.supabase
            .from("secret")
            .select("*")
            .eq("owner_user_id", ownerUserId)
            .order("name", {
              ascending: true,
            })
            .order("category", {
              ascending: true,
            });

          if (query.category) {
            request = request.eq("category", query.category);
          }

          if (query.name) {
            request = request.eq("name", query.name);
          }

          const { data, error } = await request;

          if (error) {
            throw new ApiError(500, error.message);
          }

          return (data ?? []).map((secret) =>
            toPublicSecret(secret as SecretRow),
          );
        },
        schema: secretListSchema,
      },
      path: "/secrets",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          const secret = await requireOwnedSecret(c, id);
          const { error } = await serviceRoleDb(c).rpc("secret_store_delete", {
            p_secret_id: id,
          });

          if (error) {
            throw new ApiError(500, error.message);
          }

          await writeEventRecord(c.var.supabase, {
            after: null,
            before: secret as Record<string, unknown>,
            operation: "Delete",
            resource: "secret",
          });

          return successResponse();
        },
      },
      get: {
        handler: async (c, id) =>
          toPublicSecret(await requireOwnedSecret(c, id)),
      },
      idParam: "secretId",
      patch: {
        handler: async (c, id, body) => {
          const before = await requireOwnedSecret(c, id);
          requireAnyDefined([
            body.name,
            body.value,
          ]);

          const { data, error } = await serviceRoleDb(c).rpc(
            "secret_store_update",
            {
              p_name: body.name,
              p_plaintext_value: body.value,
              p_secret_id: id,
            },
          );

          if (error || !data) {
            throw new ApiError(
              500,
              error?.message ?? "Could not update secret",
            );
          }

          const updated = data as SecretRow;
          await writeEventRecord(c.var.supabase, {
            after: updated as Record<string, unknown>,
            before: before as Record<string, unknown>,
            operation: "Update",
            resource: "secret",
          });

          return toPublicSecret(updated);
        },
        schema: secretPatchSchema,
      },
      path: "/secrets/:secretId",
    },
  });
}
