import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema, jsonValueSchema, timestampSchema } from "../base";

const tags = [
  "Events",
] as const;

const EventSchema = z.object({
  actorKeyId: baseEntitySchema.shape.id.nullable(),
  actorProfileId: baseEntitySchema.shape.id,
  afterState: jsonValueSchema.nullable(),
  beforeState: jsonValueSchema.nullable(),
  createdAt: timestampSchema,
  diff: jsonValueSchema,
  entityId: baseEntitySchema.shape.id,
  id: baseEntitySchema.shape.id,
  operation: z.enum([
    "Create",
    "Read",
    "Update",
    "Delete",
  ]),
  requestId: z.string().nullable(),
  resource: z.string(),
  source: z.enum([
    "RAW_API",
    "CLI",
    "WEB_APP",
  ]),
});

const resolutionMapSchema = z.record(
  baseEntitySchema.shape.id,
  baseEntitySchema.shape.id.nullable(),
);

export const eventOperations = defineResourceOperations({
  listForCurrentUser: {
    input: z
      .object({
        excludeSources: z.array(EventSchema.shape.source).optional(),
        limit: z.number().int().positive().max(500).optional(),
      })
      .optional(),
    output: z.array(EventSchema),
    route: {
      method: "GET",
      operationId: "events.listForCurrentUser",
      path: "/events/current-user",
      summary: "List events for the current user",
      tags,
    },
  },
  resolveTargets: {
    input: z.object({
      columnIds: z.array(baseEntitySchema.shape.id).optional(),
      programVersionIds: z.array(baseEntitySchema.shape.id).optional(),
      rowIds: z.array(baseEntitySchema.shape.id).optional(),
    }),
    output: z.object({
      columnTableIds: resolutionMapSchema,
      rowTableIds: resolutionMapSchema,
      versionProgramIds: resolutionMapSchema,
    }),
    route: {
      method: "POST",
      operationId: "events.resolveTargets",
      path: "/events/resolve-targets",
      summary: "Resolve event target parents",
      tags,
    },
  },
});
