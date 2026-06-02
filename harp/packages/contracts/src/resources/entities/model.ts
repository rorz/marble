import { apiModelSchema } from "@harp/core";
import { z } from "zod";
import { defineResourceOperations } from "../../orpc";

const tags = [
  "Model",
] as const;

export const modelOperations = defineResourceOperations({
  get: {
    input: z.object({
      projectId: z.string(),
    }),
    output: apiModelSchema,
    route: {
      method: "GET",
      operationId: "model.get",
      path: "/projects/{projectId}/model",
      summary: "Get the inferred API model",
      tags,
    },
  },
});
