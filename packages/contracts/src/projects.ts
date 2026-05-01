import { oc } from "@orpc/contract";
import { z } from "zod";

export const ProjectSchema = z.object({
  createdAt: z.string(),
  folderPath: z.array(z.string()),
  id: z.string().uuid(),
  name: z.string(),
  ownerProfileId: z.string().uuid(),
  updatedAt: z.string(),
});

export const CreateProjectInputSchema = z.object({
  folderPath: z.array(z.string()).optional(),
  name: z.string().optional(),
});

export const ListProjectsInputSchema = z
  .object({
    name: z.string().optional(),
  })
  .optional();

export const GetProjectInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const UpdateProjectInputSchema = z.object({
  projectId: z.string().uuid(),
  values: z.object({
    folderPath: z.array(z.string()).optional(),
    name: z.string().optional(),
  }),
});

export const DeleteProjectInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const projectsContract = {
  create: oc
    .route({
      method: "POST",
      path: "/projects",
    })
    .input(CreateProjectInputSchema)
    .output(ProjectSchema),
  delete: oc
    .route({
      method: "DELETE",
      path: "/projects/{projectId}",
    })
    .input(DeleteProjectInputSchema)
    .output(ProjectSchema),
  get: oc
    .route({
      method: "GET",
      path: "/projects/{projectId}",
    })
    .input(GetProjectInputSchema)
    .output(ProjectSchema),
  list: oc
    .route({
      method: "GET",
      path: "/projects",
    })
    .input(ListProjectsInputSchema)
    .output(z.array(ProjectSchema)),
  update: oc
    .route({
      method: "PATCH",
      path: "/projects/{projectId}",
    })
    .input(UpdateProjectInputSchema)
    .output(ProjectSchema),
};

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type DeleteProjectInput = z.infer<typeof DeleteProjectInputSchema>;
export type GetProjectInput = z.infer<typeof GetProjectInputSchema>;
export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
