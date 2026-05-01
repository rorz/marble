import {
  type CreateProjectInput,
  contract,
  type DeleteProjectInput,
  type GetProjectInput,
  type ListProjectsInput,
  type UpdateProjectInput,
} from "@marble/contracts";
import { implement } from "@orpc/server";
import type { ApiContext } from "./context";

const os = implement(contract).$context<ApiContext>();

type HandlerOptions<Input> = {
  context: ApiContext;
  input: Input;
};

export const projectsRouter = {
  create: os.projects.create.handler(
    ({ context, input }: HandlerOptions<CreateProjectInput>) =>
      context.store.projects.create(input),
  ),
  delete: os.projects.delete.handler(
    ({ context, input }: HandlerOptions<DeleteProjectInput>) =>
      context.store.projects.delete(input.projectId),
  ),
  get: os.projects.get.handler(
    ({ context, input }: HandlerOptions<GetProjectInput>) =>
      context.store.projects.get(input.projectId),
  ),
  list: os.projects.list.handler(
    ({ context, input }: HandlerOptions<ListProjectsInput>) =>
      context.store.projects.list(input ?? {}),
  ),
  update: os.projects.update.handler(
    ({ context, input }: HandlerOptions<UpdateProjectInput>) =>
      context.store.projects.update(input.projectId, input.values),
  ),
};

export const router = os.router({
  projects: projectsRouter,
});

export type MarbleRouter = typeof router;
