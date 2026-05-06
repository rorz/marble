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

const profileCreateSchema = ProfileSchema.pick({
  externalName: true,
  icon: true,
  name: true,
  type: true,
})
  .partial({
    externalName: true,
    icon: true,
    type: true,
  })
  .extend({
    name: ProfileSchema.shape.name.min(1),
  });

const profileUpdateSchema = ProfileSchema.pick({
  externalName: true,
  icon: true,
  name: true,
  type: true,
}).partial();

export const profileOperations = defineResourceOperations({
  create: {
    input: profileCreateSchema,
    output: ProfileSchema,
    route: {
      method: "POST",
      operationId: "profiles.create",
      path: "/profiles",
      summary: "Create a profile",
      tags,
    },
  },
  delete: {
    input: ProfileSchema.pick({
      id: true,
    }),
    output: ProfileSchema,
    route: {
      method: "DELETE",
      operationId: "profiles.delete",
      path: "/profiles/{id}",
      summary: "Delete a profile",
      tags,
    },
  },
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
