import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema, timestampSchema } from "../base";

const tags = [
  "Keys",
] as const;

const KeySchema = z.object({
  createdAt: timestampSchema,
  deletedAt: timestampSchema.nullable(),
  id: baseEntitySchema.shape.id,
  ownerProfileId: baseEntitySchema.shape.id,
  prefix: z.string(),
  preview: z.string(),
});

export const keyOperations = defineResourceOperations({
  create: {
    input: KeySchema.pick({
      ownerProfileId: true,
    }),
    output: z.object({
      key: KeySchema,
      profileId: baseEntitySchema.shape.id,
      profileName: z.string(),
      token: z.string(),
    }),
    route: {
      method: "POST",
      operationId: "keys.create",
      path: "/keys",
      summary: "Create an API key",
      tags,
    },
  },
  list: {
    input: KeySchema.pick({
      ownerProfileId: true,
    })
      .partial()
      .extend({
        includeDeleted: z.boolean().optional(),
      })
      .optional(),
    output: z.array(KeySchema),
    route: {
      method: "GET",
      operationId: "keys.list",
      path: "/keys",
      summary: "List API keys",
      tags,
    },
  },
  revoke: {
    input: KeySchema.pick({
      id: true,
    }),
    output: KeySchema,
    route: {
      method: "PATCH",
      operationId: "keys.revoke",
      path: "/keys/{id}/revoke",
      summary: "Revoke an API key",
      tags,
    },
  },
});
