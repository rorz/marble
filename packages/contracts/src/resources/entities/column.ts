import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema, jsonValueSchema } from "../base";

const tags = [
  "Columns",
] as const;

const ColumnSchema = z.object({
  ...baseEntitySchema.shape,
  idx: z.number().int().nonnegative(),
  inputTemplate: z.string(),
  name: z.string(),
  outputSchema: jsonValueSchema,
  programVersionId: baseEntitySchema.shape.id,
  runCondition: jsonValueSchema,
  tableId: baseEntitySchema.shape.id,
});

export const columnOperations = defineResourceOperations({
  create: {
    input: ColumnSchema.pick({
      idx: true,
      inputTemplate: true,
      name: true,
      outputSchema: true,
      programVersionId: true,
      runCondition: true,
      tableId: true,
    }).partial({
      idx: true,
      outputSchema: true,
      runCondition: true,
    }),
    output: ColumnSchema,
    route: {
      method: "POST",
      operationId: "columns.create",
      path: "/columns",
      summary: "Create a column",
      tags,
    },
  },
  delete: {
    input: ColumnSchema.pick({
      id: true,
    }),
    output: ColumnSchema,
    route: {
      method: "DELETE",
      operationId: "columns.delete",
      path: "/columns/{id}",
      summary: "Delete a column",
      tags,
    },
  },
  get: {
    input: ColumnSchema.pick({
      id: true,
    }),
    output: ColumnSchema,
    route: {
      method: "GET",
      operationId: "columns.get",
      path: "/columns/{id}",
      summary: "Get a column",
      tags,
    },
  },
  list: {
    input: ColumnSchema.pick({
      tableId: true,
    }),
    output: z.array(ColumnSchema),
    route: {
      method: "GET",
      operationId: "columns.list",
      path: "/columns",
      summary: "List columns",
      tags,
    },
  },
  listReferenceable: {
    input: z.object({}).optional(),
    output: z.array(
      ColumnSchema.pick({
        id: true,
        name: true,
        tableId: true,
      }).extend({
        allowManualInput: z.boolean(),
        label: z.string(),
        projectId: baseEntitySchema.shape.id,
        projectName: z.string(),
        tableName: z.string(),
      }),
    ),
    route: {
      method: "GET",
      operationId: "columns.listReferenceable",
      path: "/columns/referenceable",
      summary: "List referenceable columns",
      tags,
    },
  },
  update: {
    input: ColumnSchema.pick({
      id: true,
    }).extend({
      values: ColumnSchema.pick({
        idx: true,
        inputTemplate: true,
        name: true,
        outputSchema: true,
        programVersionId: true,
        runCondition: true,
      }).partial(),
    }),
    output: ColumnSchema,
    route: {
      method: "PATCH",
      operationId: "columns.update",
      path: "/columns/{id}",
      summary: "Update a column",
      tags,
    },
  },
});
