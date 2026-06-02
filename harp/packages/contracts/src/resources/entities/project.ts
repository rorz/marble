import { z } from "zod";
import { defineResourceOperations } from "../../orpc";
import { baseEntitySchema } from "../base";

const tags = [
  "Projects",
] as const;

const ProjectSchema = z.object({
  ...baseEntitySchema.shape,
  host: z.string(),
  name: z.string(),
});

export const projectOperations = defineResourceOperations({
  create: {
    input: z.object({
      host: z.string().optional(),
      name: z.string().min(1),
    }),
    output: ProjectSchema,
    route: {
      method: "POST",
      operationId: "projects.create",
      path: "/projects",
      summary: "Create a project",
      tags,
    },
  },
  get: {
    input: z.object({
      id: z.string(),
    }),
    output: ProjectSchema,
    route: {
      method: "GET",
      operationId: "projects.get",
      path: "/projects/{id}",
      summary: "Get a project",
      tags,
    },
  },
  list: {
    input: z.object({}),
    output: z.array(ProjectSchema),
    route: {
      method: "GET",
      operationId: "projects.list",
      path: "/projects",
      summary: "List projects",
      tags,
    },
  },
});
