import { z } from "zod";
import { defineResourceOperations } from "../../orpc";
import { baseEntitySchema, jsonValueSchema, timestampSchema } from "../base";

const tags = [
  "Source Events",
] as const;

const SourceEventSchema = z.object({
  createdAt: timestampSchema,
  id: baseEntitySchema.shape.id,
  parsedPayload: jsonValueSchema.nullable(),
  parseError: z.string().nullable(),
  projectId: baseEntitySchema.shape.id,
  rawPayload: jsonValueSchema,
  sourceId: baseEntitySchema.shape.id,
});

const sourceEventLimitSchema = {
  limit: z.int().positive().max(200).optional(),
} as const;

const listSourceEventsInputSchema = z.union([
  SourceEventSchema.pick({
    projectId: true,
  }).extend({
    ...sourceEventLimitSchema,
    sourceId: SourceEventSchema.shape.sourceId.optional(),
  }),
  SourceEventSchema.pick({
    sourceId: true,
  }).extend({
    ...sourceEventLimitSchema,
    projectId: SourceEventSchema.shape.projectId.optional(),
  }),
]);

export const sourceEventOperations = defineResourceOperations({
  create: {
    input: SourceEventSchema.pick({
      rawPayload: true,
      sourceId: true,
    }),
    output: SourceEventSchema,
    route: {
      method: "POST",
      operationId: "sourceEvents.create",
      path: "/source-events",
      summary: "Create a source event",
      tags,
    },
  },
  get: {
    input: SourceEventSchema.pick({
      id: true,
    }),
    output: SourceEventSchema,
    route: {
      method: "GET",
      operationId: "sourceEvents.get",
      path: "/source-events/{id}",
      summary: "Retrieve a source event",
      tags,
    },
  },
  list: {
    input: listSourceEventsInputSchema,
    output: z.array(SourceEventSchema),
    route: {
      method: "GET",
      operationId: "sourceEvents.list",
      path: "/source-events",
      summary: "List source events",
      tags,
    },
  },
});
