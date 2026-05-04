import z from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema } from "../base";

const tags = ["Source events"] as const;

const SourceEventSchema = z.object({
  ...baseEntitySchema.shape,
  parsedPayload: z.json().nullable(),
  parseError: z.string().nullable(),
  rawPayload: z.json(),
  sourceId: z.uuidv7(),
});

export const sourceEventOperations = defineResourceOperations({
  create: {
    input: SourceEventSchema.pick({
      rawPayload: true,
      sourceId: true,
    }),
    output: SourceEventSchema,
    route: {
      method: "GET",
      operationId: "source_events.get",
      path: "/source_events/{id}",
      summary: "Retrieve a source event",
      tags,
    },
  },
});
