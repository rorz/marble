import { projectsContract } from "./projects";

export type {
  CreateProjectInput,
  DeleteProjectInput,
  GetProjectInput,
  ListProjectsInput,
  Project,
  UpdateProjectInput,
} from "./projects";
export {
  CreateProjectInputSchema,
  DeleteProjectInputSchema,
  GetProjectInputSchema,
  ListProjectsInputSchema,
  ProjectSchema,
  projectsContract,
  UpdateProjectInputSchema,
} from "./projects";

export const contract = {
  projects: projectsContract,
};

export type MarbleContract = typeof contract;
