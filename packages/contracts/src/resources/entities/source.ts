import z from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema } from "../base";

const tags = ["Sources"] as const;

const SourceSchema = z.object({
  ...baseEntitySchema.shape,
  name: z.string(),
  payloadSchema: z.json(),
  projectId: z.uuidv7(),
  webhookToken: z.string(),
});

export const sourceOperations = defineResourceOperations({
  create: {
    input: SourceSchema.pick({
      name: true,
      payloadSchema: true,
      projectId: true,
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
  get: {
    input: SourceSchema.pick({
      id: true,
    }),
    output: SourceSchema.nullable(),
    route: {
      method: "GET",
      operationId: "sources.get",
      path: "/sources/{id}",
      summary: "Retrieve a source",
      tags,
    },
  },
  list: {
    input: z
      .object({
        ...SourceSchema.pick({
          projectId: true,
        }).shape,
        createdAfter: z.iso.datetime(),
        createdBefore: z.iso.datetime(),
      })
      .partial()
      .optional(),
    output: z.array(SourceSchema),
    route: {
      method: "GET",
      operationId: "sources.list",
      path: "/sources/{id}",
      summary: "List sources",
      tags,
    },
  },
  update: {
    input: SourceSchema.pick({
      id: true,
      name: true,
      payloadSchema: true,
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
