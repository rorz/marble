import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema, jsonValueSchema } from "../base";

const tags = [
  "Sources",
] as const;

const SourceSchema = z.object({
  ...baseEntitySchema.shape,
  name: z.string(),
  payloadSchema: jsonValueSchema,
  projectId: baseEntitySchema.shape.id,
  webhookToken: z.string(),
});

export const sourceOperations = defineResourceOperations({
  create: {
    input: SourceSchema.omit({
      createdAt: true,
      id: true,
      updatedAt: true,
      webhookToken: true,
    }).extend({
      name: SourceSchema.shape.name.optional(),
      payloadSchema: SourceSchema.shape.payloadSchema.optional(),
    }),
    output: SourceSchema,
    route: {
      method: "POST",
      operationId: "sources.create",
      path: "/sources",
      summary: "Create a source",
      tags,
    },
  },
  delete: {
    input: SourceSchema.pick({
      id: true,
    }),
    output: SourceSchema,
    route: {
      method: "DELETE",
      operationId: "sources.delete",
      path: "/sources/{id}",
      summary: "Delete a source",
      tags,
    },
  },
  get: {
    input: SourceSchema.pick({
      id: true,
    }),
    output: SourceSchema,
    route: {
      method: "GET",
      operationId: "sources.get",
      path: "/sources/{id}",
      summary: "Retrieve a source",
      tags,
    },
  },
  list: {
    input: SourceSchema.pick({
      projectId: true,
    }),
    output: z.array(SourceSchema),
    route: {
      method: "GET",
      operationId: "sources.list",
      path: "/sources",
      summary: "List sources",
      tags,
    },
  },
  update: {
    input: SourceSchema.pick({
      id: true,
    }).extend({
      values: SourceSchema.pick({
        name: true,
        payloadSchema: true,
      }).partial(),
    }),
    output: SourceSchema,
    route: {
      method: "PATCH",
      operationId: "sources.update",
      path: "/sources/{id}",
      summary: "Update a source",
      tags,
    },
  },
});
