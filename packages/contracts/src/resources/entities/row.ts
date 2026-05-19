import { z } from "zod";
import { defineResourceOperations } from "../../orpc";
import { baseEntitySchema } from "../base";

const tags = [
  "Rows",
] as const;

const RowSchema = z.object({
  ...baseEntitySchema.shape,
  idx: z.number().int().nonnegative(),
  tableId: baseEntitySchema.shape.id,
});

export const rowOperations = defineResourceOperations({
  delete: {
    input: RowSchema.pick({
      id: true,
    }),
    output: RowSchema,
    route: {
      method: "DELETE",
      operationId: "rows.delete",
      path: "/rows/{id}",
      summary: "Delete a row",
      tags,
    },
  },
  get: {
    input: RowSchema.pick({
      id: true,
    }),
    output: RowSchema,
    route: {
      method: "GET",
      operationId: "rows.get",
      path: "/rows/{id}",
      summary: "Get a row",
      tags,
    },
  },
  list: {
    input: RowSchema.pick({
      tableId: true,
    }),
    output: z.array(RowSchema),
    route: {
      method: "GET",
      operationId: "rows.list",
      path: "/rows",
      summary: "List rows",
      tags,
    },
  },
  update: {
    input: RowSchema.pick({
      id: true,
    }).extend({
      values: RowSchema.pick({
        idx: true,
      }).partial(),
    }),
    output: RowSchema,
    route: {
      method: "PATCH",
      operationId: "rows.update",
      path: "/rows/{id}",
      summary: "Update a row",
      tags,
    },
  },
});
