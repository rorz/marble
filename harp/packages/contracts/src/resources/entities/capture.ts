import { coverageDeltaSchema, harSchema } from "@harp/core";
import { z } from "zod";
import { defineResourceOperations } from "../../orpc";
import { baseEntitySchema } from "../base";

const tags = [
  "Captures",
] as const;

const CaptureSummarySchema = z.object({
  ...baseEntitySchema.shape,
  endpointCount: z.number().int(),
  projectId: z.string(),
  sampleCount: z.number().int(),
});

const IngestResultSchema = z.object({
  capture: CaptureSummarySchema,
  delta: coverageDeltaSchema,
});

export const captureOperations = defineResourceOperations({
  ingest: {
    input: z.object({
      har: harSchema,
      projectId: z.string(),
    }),
    output: IngestResultSchema,
    route: {
      description:
        "Reverse-engineer a HAR archive into the project's API model, refresh its coverage map, regenerate the oRPC contract, and return what this capture unlocked.",
      method: "POST",
      operationId: "captures.ingest",
      path: "/projects/{projectId}/captures",
      summary: "Ingest a HAR capture",
      tags,
    },
  },
  list: {
    input: z.object({
      projectId: z.string(),
    }),
    output: z.array(CaptureSummarySchema),
    route: {
      method: "GET",
      operationId: "captures.list",
      path: "/projects/{projectId}/captures",
      summary: "List captures",
      tags,
    },
  },
});
