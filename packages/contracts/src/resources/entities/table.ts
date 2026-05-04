import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema } from "../base";

const tags = [
  "Tables",
] as const;

const TableSchema = z.object({
  ...baseEntitySchema.shape,
  name: z.string(),
  projectId: baseEntitySchema.shape.id,
});

export const tableOperations = defineResourceOperations({
  create: {
    input: TableSchema.pick({
      name: true,
      projectId: true,
    }).extend({
      name: TableSchema.shape.name.optional(),
    }),
    output: TableSchema,
    route: {
      method: "POST",
      operationId: "tables.create",
      path: "/tables",
      summary: "Create a table",
      tags,
    },
  },
  delete: {
    input: TableSchema.pick({
      id: true,
    }),
    output: TableSchema,
    route: {
      method: "DELETE",
      operationId: "tables.delete",
      path: "/tables/{id}",
      summary: "Delete a table",
      tags,
    },
  },
  get: {
    input: TableSchema.pick({
      id: true,
    }),
    output: TableSchema,
    route: {
      method: "GET",
      operationId: "tables.get",
      path: "/tables/{id}",
      summary: "Get a table",
      tags,
    },
  },
  insertRows: {
    input: TableSchema.pick({
      id: true,
    }).extend({
      id: TableSchema.shape.id.describe(
        "The ID of the table to insert rows into.",
      ),
      idx: z.int().nonnegative(),
      quantity: z.int().positive(),
    }),
    output: z.object({
      cellCount: z.number().int().nonnegative(),
      rowCount: z.number().int().nonnegative(),
    }),
    route: {
      method: "POST",
      operationId: "tables.insertRows",
      path: "/tables/{id}/rows/insert",
      summary: "Insert rows",
      tags,
    },
  },
  list: {
    input: TableSchema.pick({
      projectId: true,
    }),
    output: z.array(TableSchema),
    route: {
      method: "GET",
      operationId: "tables.list",
      path: "/tables",
      summary: "List tables",
      tags,
    },
  },
  update: {
    input: TableSchema.pick({
      id: true,
    }).extend({
      values: TableSchema.pick({
        name: true,
      }).partial(),
    }),
    output: TableSchema,
    route: {
      method: "PATCH",
      operationId: "tables.update",
      path: "/tables/{id}",
      summary: "Update a table",
      tags,
    },
  },
});
