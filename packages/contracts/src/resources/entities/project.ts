import { z } from "zod";
import { defineResourceOperations } from "../../orpc";
import { baseEntitySchema } from "../base";

const tags = [
  "Projects",
] as const;

const ProjectSchema = z.object({
  ...baseEntitySchema.shape,
  folderPath: z.array(z.string()),
  name: z.string(),
  ownerProfileId: baseEntitySchema.shape.id,
});

const projectIdInputSchema = z.object({
  projectId: ProjectSchema.shape.id,
});

export const projectOperations = defineResourceOperations({
  create: {
    input: ProjectSchema.pick({
      folderPath: true,
      name: true,
    }).partial(),
    output: ProjectSchema,
    route: {
      method: "POST",
      operationId: "projects.create",
      path: "/projects",
      summary: "Creates a project",
      tags,
    },
  },
  delete: {
    input: projectIdInputSchema,
    output: ProjectSchema,
    route: {
      method: "DELETE",
      operationId: "projects.delete",
      path: "/projects/{projectId}",
      summary: "Delete a project",
      tags,
    },
  },
  get: {
    input: projectIdInputSchema,
    output: ProjectSchema,
    route: {
      method: "GET",
      operationId: "projects.get",
      path: "/projects/{projectId}",
      summary: "Get a project",
      tags,
    },
  },
  getMostRecentProject: {
    // NOTE:  This is a non-serious (non-production) perforation
    //        in order to test what the contract definition -> RPC is like
    //
    input: z.object({}),
    output: ProjectSchema.nullable(),
    route: {
      description:
        "Returns the newest project for the current user, or null when no project exists.",
      method: "GET",
      operationId: "projects.getMostRecentProject",
      path: "/projects/most-recent",
      summary: "Get most recent project",
      tags,
    },
  },
  list: {
    input: ProjectSchema.pick({
      name: true,
    })
      .partial()
      .optional(),
    output: z.array(ProjectSchema),
    route: {
      method: "GET",
      operationId: "projects.list",
      path: "/projects",
      summary: "List projects",
      tags,
    },
  },
  update: {
    input: projectIdInputSchema.extend({
      values: ProjectSchema.pick({
        folderPath: true,
        name: true,
      }).partial(),
    }),
    output: ProjectSchema,
    route: {
      method: "PATCH",
      operationId: "projects.update",
      path: "/projects/{projectId}",
      summary: "Update a project",
      tags,
    },
  },
});
