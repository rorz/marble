import { coverageMapSchema } from "@harp/core";
import { z } from "zod";
import { defineResourceOperations } from "../../orpc";

const tags = [
  "Coverage",
] as const;

export const coverageOperations = defineResourceOperations({
  get: {
    input: z.object({
      projectId: z.string(),
    }),
    output: coverageMapSchema,
    route: {
      description:
        "The swiss-cheese map: per-surface tiles that are unlocked, discovered, or still holes waiting to be captured.",
      method: "GET",
      operationId: "coverage.get",
      path: "/projects/{projectId}/coverage",
      summary: "Get the coverage map",
      tags,
    },
  },
});
