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
});
