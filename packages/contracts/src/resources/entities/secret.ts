import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema } from "../base";

const tags = [
  "Secrets",
] as const;

const secretNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
const secretValueSchema = z.string().min(1);

const SecretSchema = z.object({
  ...baseEntitySchema.shape,
  category: z.enum([
    "Managed",
    "UserDefined",
  ]),
  name: secretNameSchema,
  ownerUserId: baseEntitySchema.shape.id,
});

export const secretOperations = defineResourceOperations({
  create: {
    input: SecretSchema.pick({
      category: true,
      name: true,
    })
      .extend({
        value: secretValueSchema,
      })
      .partial({
        category: true,
      }),
    output: SecretSchema,
    route: {
      method: "POST",
      operationId: "secrets.create",
      path: "/secrets",
      summary: "Create a secret",
      tags,
    },
  },
  delete: {
    input: SecretSchema.pick({
      id: true,
    }),
    output: SecretSchema,
    route: {
      method: "DELETE",
      operationId: "secrets.delete",
      path: "/secrets/{id}",
      summary: "Delete a secret",
      tags,
    },
  },
  get: {
    input: SecretSchema.pick({
      id: true,
    }),
    output: SecretSchema,
    route: {
      method: "GET",
      operationId: "secrets.get",
      path: "/secrets/{id}",
      summary: "Get a secret",
      tags,
    },
  },
  list: {
    input: SecretSchema.pick({
      category: true,
      name: true,
    })
      .partial()
      .optional(),
    output: z.array(SecretSchema),
    route: {
      method: "GET",
      operationId: "secrets.list",
      path: "/secrets",
      summary: "List secrets",
      tags,
    },
  },
  update: {
    input: SecretSchema.pick({
      id: true,
    }).extend({
      values: SecretSchema.pick({
        name: true,
      })
        .extend({
          value: secretValueSchema,
        })
        .partial(),
    }),
    output: SecretSchema,
    route: {
      method: "PATCH",
      operationId: "secrets.update",
      path: "/secrets/{id}",
      summary: "Update a secret",
      tags,
    },
  },
});
