import z from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema } from "../base";

const tags = ["Pipes"] as const;

const PipeSchema = z.object({
  ...baseEntitySchema.shape,
  mappings: z.json(),
  sourceId: z.uuidv7(),
  tableId: z.uuidv7(),
});

export const pipeOperations = defineResourceOperations({
  create: {
    input: PipeSchema.pick({
      mappings: true,
      sourceId: true,
      tableId: true,
    }),
    output: PipeSchema,
    route: {
      method: "GET",
      operationId: "pipes.get",
      path: "/pipes/{id}",
      summary: "Retrieve a pipe.",
      tags,
    },
  },
});
