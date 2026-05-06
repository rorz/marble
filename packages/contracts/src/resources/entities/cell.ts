import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema, jsonValueSchema } from "../base";

const tags = [
  "Cells",
] as const;

const CellSchema = z.object({
  ...baseEntitySchema.shape,
  columnId: baseEntitySchema.shape.id,
  manualInput: z.string().nullable(),
  rowId: baseEntitySchema.shape.id,
  state: jsonValueSchema.nullable(),
});

const listCellsInputSchema = z.union([
  CellSchema.pick({
    columnId: true,
  }).extend({
    rowId: CellSchema.shape.rowId.optional(),
  }),
  CellSchema.pick({
    rowId: true,
  }).extend({
    columnId: CellSchema.shape.columnId.optional(),
  }),
]);

export const cellOperations = defineResourceOperations({
  get: {
    input: CellSchema.pick({
      id: true,
    }),
    output: CellSchema,
    route: {
      method: "GET",
      operationId: "cells.get",
      path: "/cells/{id}",
      summary: "Get a cell",
      tags,
    },
  },
  list: {
    input: listCellsInputSchema,
    output: z.array(CellSchema),
    route: {
      method: "GET",
      operationId: "cells.list",
      path: "/cells",
      summary: "List cells",
      tags,
    },
  },
  run: {
    input: CellSchema.pick({
      id: true,
    }).extend({
      manualInput: CellSchema.shape.manualInput.optional(),
    }),
    output: z.object({
      error: z.boolean().optional(),
      message: z.string().optional(),
      output: jsonValueSchema,
      runId: baseEntitySchema.shape.id,
      success: z.boolean(),
    }),
    route: {
      method: "POST",
      operationId: "cells.run",
      path: "/cells/{id}/run",
      summary: "Run a cell",
      tags,
    },
  },
  setManualValue: {
    input: CellSchema.pick({
      id: true,
    }).extend({
      value: CellSchema.shape.manualInput,
    }),
    output: CellSchema,
    route: {
      method: "PATCH",
      operationId: "cells.setManualValue",
      path: "/cells/{id}/manual-value",
      summary: "Set manual cell value",
      tags,
    },
  },
});
