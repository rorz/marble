import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema } from "../base";

const tags = [
  "Profiles",
] as const;

export const ProfileSchema = z.object({
  ...baseEntitySchema.shape,
  externalName: z.string().nullable(),
  icon: z.string().nullable(),
  name: z.string(),
  ownerUserId: baseEntitySchema.shape.id,
  type: z.enum([
    "Human",
    "Agent",
  ]),
});

const profileUpdateSchema = ProfileSchema.pick({
  externalName: true,
  icon: true,
  name: true,
}).partial();

// Profiles are fully system-owned. Every user is auto-issued exactly one
// Human and one Agent profile on signup via the on_auth_user_created
// trigger, and a UNIQUE (owner_user_id, type) constraint makes that pair
// permanent. There is no public create/delete: the lifecycle is the pair.
export const profileOperations = defineResourceOperations({
  get: {
    input: ProfileSchema.pick({
      id: true,
    }),
    output: ProfileSchema,
    route: {
      method: "GET",
      operationId: "profiles.get",
      path: "/profiles/{id}",
      summary: "Get a profile",
      tags,
    },
  },
  list: {
    input: ProfileSchema.pick({
      type: true,
    })
      .partial()
      .optional(),
    output: z.array(ProfileSchema),
    route: {
      method: "GET",
      operationId: "profiles.list",
      path: "/profiles",
      summary: "List profiles",
      tags,
    },
  },
  update: {
    input: ProfileSchema.pick({
      id: true,
    }).extend({
      values: profileUpdateSchema,
    }),
    output: ProfileSchema,
    route: {
      method: "PATCH",
      operationId: "profiles.update",
      path: "/profiles/{id}",
      summary: "Update a profile",
      tags,
    },
  },
});
