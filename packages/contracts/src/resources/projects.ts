import { z } from "zod";
import { defineResourceOperations } from "../helpers";

const ProjectSchema = z.object({
  createdAt: z.string(),
  folderPath: z.array(z.string()),
  id: z.uuidv4(),
  name: z.string(),
  ownerProfileId: z.uuidv4(),
  updatedAt: z.string(),
});

const CreateProjectInputSchema = z.object({
  folderPath: z.array(z.string()).optional(),
  name: z.string().optional(),
});

const ListProjectsInputSchema = z
  .object({
    name: z.string().optional(),
  })
  .optional();

const GetProjectInputSchema = z.object({
  projectId: z.uuidv4(),
});

const GetMostRecentProjectInputSchema = z.object({}).optional();

const UpdateProjectInputSchema = z.object({
  projectId: z.uuidv4(),
  values: z.object({
    folderPath: z.array(z.string()).optional(),
    name: z.string().optional(),
  }),
});

const DeleteProjectInputSchema = z.object({
  projectId: z.uuidv4(),
});

const projectTags = [
  "Projects",
] as const;

export const projectOperations = defineResourceOperations({
  create: {
    input: CreateProjectInputSchema,
    output: ProjectSchema,
    route: {
      method: "POST",
      operationId: "projects.create",
      path: "/projects",
      summary: "Create a project",
      tags: projectTags,
    },
  },
  delete: {
    input: DeleteProjectInputSchema,
    output: ProjectSchema,
    route: {
      method: "DELETE",
      operationId: "projects.delete",
      path: "/projects/{projectId}",
      summary: "Delete a project",
      tags: projectTags,
    },
  },
  get: {
    input: GetProjectInputSchema,
    output: ProjectSchema,
    route: {
      method: "GET",
      operationId: "projects.get",
      path: "/projects/{projectId}",
      summary: "Get a project",
      tags: projectTags,
    },
  },
  getMostRecentProject: {
    // NOTE:  This is a non-serious (non-production) perforation
    //        in order to test what the contract definition -> RPC is like
    //
    input: GetMostRecentProjectInputSchema,
    output: ProjectSchema.nullable(),
    route: {
      description:
        "Returns the newest project for the current profile, or null when no project exists.",
      method: "GET",
      operationId: "projects.getMostRecentProject",
      path: "/projects/most-recent",
      summary: "Get most recent project",
      tags: projectTags,
    },
  },
  list: {
    input: ListProjectsInputSchema,
    output: z.array(ProjectSchema),
    route: {
      method: "GET",
      operationId: "projects.list",
      path: "/projects",
      summary: "List projects",
      tags: projectTags,
    },
  },
  update: {
    input: UpdateProjectInputSchema,
    output: ProjectSchema,
    route: {
      method: "PATCH",
      operationId: "projects.update",
      path: "/projects/{projectId}",
      summary: "Update a project",
      tags: projectTags,
    },
  },
});

type ProjectOperationName = keyof typeof projectOperations;
type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
type DeleteProjectInput = z.infer<typeof DeleteProjectInputSchema>;
type GetMostRecentProjectInput = z.infer<
  typeof GetMostRecentProjectInputSchema
>;
type GetProjectInput = z.infer<typeof GetProjectInputSchema>;
type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;
type Project = z.infer<typeof ProjectSchema>;
type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
