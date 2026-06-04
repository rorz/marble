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
      auth: z.string(),
      cli: z.string(),
      contract: z.string(),
      openapi: z.string(),
      sdk: z.string(),
    }),
    route: {
      description:
        "The generated, standalone artifacts for the reverse-engineered API: the oRPC contract, a typed SDK, a CLI, an OpenAPI 3.1 spec, and the inferred auth notes.",
      method: "GET",
      operationId: "contract.get",
      path: "/projects/{projectId}/contract",
      summary: "Get the generated oRPC contract",
      tags,
    },
  },
});
