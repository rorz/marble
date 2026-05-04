import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema } from "../base";

const tags = [
  "Pipes",
] as const;

const PipeMappingSchema = z.object({
  columnId: baseEntitySchema.shape.id,
  jsonPath: z.string().trim().min(1),
});

const PipeSchema = z.object({
  ...baseEntitySchema.shape,
  mappings: z.array(PipeMappingSchema),
  sourceId: baseEntitySchema.shape.id,
  tableId: baseEntitySchema.shape.id,
});

const listPipesInputSchema = z.union([
  PipeSchema.pick({
    sourceId: true,
  }).extend({
    tableId: PipeSchema.shape.tableId.optional(),
  }),
  PipeSchema.pick({
    tableId: true,
  }).extend({
    sourceId: PipeSchema.shape.sourceId.optional(),
  }),
]);

export const pipeOperations = defineResourceOperations({
  create: {
    input: PipeSchema.pick({
      mappings: true,
      sourceId: true,
      tableId: true,
    }).extend({
      mappings: PipeSchema.shape.mappings.optional(),
    }),
    output: PipeSchema,
    route: {
      method: "POST",
      operationId: "pipes.create",
      path: "/pipes",
      summary: "Create a pipe",
      tags,
    },
  },
  delete: {
    input: PipeSchema.pick({
      id: true,
    }),
    output: PipeSchema,
    route: {
      method: "DELETE",
      operationId: "pipes.delete",
      path: "/pipes/{id}",
      summary: "Delete a pipe",
      tags,
    },
  },
  get: {
    input: PipeSchema.pick({
      id: true,
    }),
    output: PipeSchema,
    route: {
      method: "GET",
      operationId: "pipes.get",
      path: "/pipes/{id}",
      summary: "Retrieve a pipe",
      tags,
    },
  },
  list: {
    input: listPipesInputSchema,
    output: z.array(PipeSchema),
    route: {
      method: "GET",
      operationId: "pipes.list",
      path: "/pipes",
      summary: "List pipes",
      tags,
    },
  },
  update: {
    input: PipeSchema.pick({
      id: true,
    }).extend({
      values: PipeSchema.pick({
        mappings: true,
        sourceId: true,
        tableId: true,
      }).partial(),
    }),
    output: PipeSchema,
    route: {
      method: "PATCH",
      operationId: "pipes.update",
      path: "/pipes/{id}",
      summary: "Update a pipe",
      tags,
    },
  },
});
