import { z } from "zod";
import { defineResourceOperations } from "../helpers";

const tags = ["Projects"] as const;

const ProjectSchema = z.object({
  createdAt: z.string(),
  folderPath: z.array(z.string()),
  id: z.uuidv4(),
  name: z.string(),
  ownerProfileId: z.uuidv4(),
  updatedAt: z.string(),
});

export const projectOperations = defineResourceOperations({
  create: {
    input: z.object({
      folderPath: z.array(z.string()).optional(),
      name: z.string().optional(),
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
  delete: {
    input: z.object({
      projectId: z.uuidv4(),
    }),
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
    input: z.object({
      projectId: z.uuidv4(),
    }),
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
        "Returns the newest project for the current profile, or null when no project exists.",
      method: "GET",
      operationId: "projects.getMostRecentProject",
      path: "/projects/most-recent",
      summary: "Get most recent project",
      tags,
    },
  },
  list: {
    input: z
      .object({
        name: z.string().optional(),
      })
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
    input: z.object({
      projectId: z.uuidv4(),
      values: z.object({
        folderPath: z.array(z.string()).optional(),
        name: z.string().optional(),
      }),
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
