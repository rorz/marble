import type { SupabaseClient } from "@marble/supabase";
import type { Hono } from "hono";
import {
  type ApiEnv,
  ApiError,
  mountResource,
  requireAnyDefined,
} from "../core";
import {
  createRecord,
  getRecord,
  listRecordsFromQuery,
  updateRecord,
} from "../data";
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

const profileCreateSchema = requestObject({
  externalName: nonEmptyStringSchema.nullable().optional(),
  icon: nonEmptyStringSchema.nullable().optional(),
  name: nonEmptyStringSchema,
  ownerUserId: uuidSchema.optional(),
  type: profileTypeSchema.optional(),
});

const profileUpdateSchema = requestObject({
  externalName: nonEmptyStringSchema.nullable().optional(),
  icon: nonEmptyStringSchema.nullable().optional(),
  name: nonEmptyStringSchema.optional(),
  type: profileTypeSchema.optional(),
});

function resolveOwnerUserId(options: {
  authenticatedUserId?: string;
  ownerUserId?: string;
}) {
  if (!options.authenticatedUserId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (
    options.ownerUserId &&
    options.ownerUserId !== options.authenticatedUserId
  ) {
    throw new ApiError(
      403,
      "owner_user_id is fixed by the authenticated web session and cannot be overridden.",
    );
  }

  return options.authenticatedUserId;
}

function resolveOwnerUserFilter(options: {
  authenticatedUserId?: string;
  ownerUserId?: string;
}) {
  if (!options.authenticatedUserId) {
    return options.ownerUserId;
  }

  if (
    options.ownerUserId &&
    options.ownerUserId !== options.authenticatedUserId
  ) {
    throw new ApiError(
      403,
      "owner_user_id filters must match the authenticated web session.",
    );
  }

  return options.authenticatedUserId;
}

function resolveProfileIdFilter(options: {
  authenticatedProfileId?: string;
  requestedProfileId?: string;
}) {
  if (!options.authenticatedProfileId) {
    return options.requestedProfileId;
  }

  if (
    options.requestedProfileId &&
    options.requestedProfileId !== options.authenticatedProfileId
  ) {
    throw new ApiError(
      403,
      "profile filters must match the authenticated API key profile.",
    );
  }

  return options.authenticatedProfileId;
}

export async function requireAccessibleProfile(
  supabase: SupabaseClient,
  options: {
    authenticatedProfileId?: string;
    profileId: string;
    userId?: string;
  },
) {
  const profile = await getRecord(supabase, "profile", options.profileId);

  if (options.userId && profile.owner_user_id !== options.userId) {
    throw new ApiError(404, "Profile not found");
  }

  if (
    options.authenticatedProfileId &&
    profile.id !== options.authenticatedProfileId
  ) {
    throw new ApiError(404, "Profile not found");
  }

  return profile;
}

export async function requireOwnedProfileForUser(
  supabase: SupabaseClient,
  options: {
    profileId: string;
    userId?: string;
  },
) {
  return requireAccessibleProfile(supabase, {
    profileId: options.profileId,
    userId: options.userId,
  });
}

export function mountProfileResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: async (c, body) => {
          const data = await createRecord(c.var.supabase, "profile", {
            external_name: body.externalName ?? null,
            icon: body.icon ?? null,
            name: body.name,
            owner_user_id: resolveOwnerUserId({
              authenticatedUserId: c.var.auth?.userId,
              ownerUserId: body.ownerUserId,
            }),
            type: body.type ?? "Agent",
          });

          return {
            data,
            location: `/profiles/${data.id}`,
          };
        },
        schema: profileCreateSchema,
      },
      list: {
        handler: (c, query) =>
          listRecordsFromQuery(
            c.var.supabase,
            "profile",
            {
              ...query,
              id: c.var.auth?.userId
                ? undefined
                : resolveProfileIdFilter({
                    authenticatedProfileId: c.var.auth?.profileId,
                  }),
              ownerUserId: resolveOwnerUserFilter({
                authenticatedUserId: c.var.auth?.userId,
                ownerUserId: query.ownerUserId,
              }),
            },
            {
              id: "id",
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
        handler: (c, id) =>
          requireAccessibleProfile(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.userId
              ? undefined
              : c.var.auth?.profileId,
            profileId: id,
            userId: c.var.auth?.userId,
          }),
      },
      idParam: "profileId",
      patch: {
        handler: async (c, id, body) => {
          await requireAccessibleProfile(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.userId
              ? undefined
              : c.var.auth?.profileId,
            profileId: id,
            userId: c.var.auth?.userId,
          });
          requireAnyDefined([
            body.externalName,
            body.icon,
            body.name,
            body.type,
          ]);

          return updateRecord(c.var.supabase, "profile", id, {
            external_name: body.externalName,
            icon: body.icon,
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
  options: {
    authenticatedProfileId?: string;
    ownerProfileId?: string;
  },
) {
  if (options.authenticatedProfileId) {
    if (
      options.ownerProfileId &&
      options.ownerProfileId !== options.authenticatedProfileId
    ) {
      throw new ApiError(
        403,
        "owner_profile_id is fixed by the authenticated API key and cannot be overridden.",
      );
    }

    await getRecord(supabase, "profile", options.authenticatedProfileId);
    return options.authenticatedProfileId;
  }

  if (options.ownerProfileId) {
    await getRecord(supabase, "profile", options.ownerProfileId);
    return options.ownerProfileId;
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

export function resolveOwnerProfileFilter(options: {
  authenticatedProfileId?: string;
  ownerProfileId?: string;
}) {
  if (!options.authenticatedProfileId) {
    return options.ownerProfileId;
  }

  if (
    options.ownerProfileId &&
    options.ownerProfileId !== options.authenticatedProfileId
  ) {
    throw new ApiError(
      403,
      "owner_profile_id filters must match the authenticated API key profile.",
    );
  }

  return options.authenticatedProfileId;
}

export async function validateOwnerProfileId(
  supabase: SupabaseClient,
  options: {
    authenticatedProfileId?: string;
    ownerProfileId?: string;
  },
) {
  if (options.ownerProfileId === undefined) {
    return undefined;
  }

  return resolveOwnerProfileId(supabase, options);
}
