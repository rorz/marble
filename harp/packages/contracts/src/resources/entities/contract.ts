import { z } from "zod";
import { defineResourceOperations } from "../../orpc";

const tags = [
  "Contract",
] as const;

export const contractOperations = defineResourceOperations({
  get: {
    input: z.object({
      projectId: z.string(),
    }),
    output: z.object({
      source: z.string(),
    }),
    route: {
      description:
        "The generated, standalone oRPC contract source for the reverse-engineered API.",
      method: "GET",
      operationId: "contract.get",
      path: "/projects/{projectId}/contract",
      summary: "Get the generated oRPC contract",
      tags,
    },
  },
});
