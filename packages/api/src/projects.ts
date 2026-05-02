import { contract } from "@marble/contracts";
import { implement } from "@orpc/server";
import type { ApiContext } from "./context";

const os = implement(contract).$context<ApiContext>();

export const projectsRouter = {
  create: os.projects.create.handler(({ context, input }) =>
    context.store.projects.create(input),
  ),
  delete: os.projects.delete.handler(({ context, input }) =>
    context.store.projects.delete(input),
  ),
  get: os.projects.get.handler(({ context, input }) =>
    context.store.projects.get(input),
  ),
  getMostRecentProject: os.projects.getMostRecentProject.handler(
    ({ context, input }) => context.store.projects.getMostRecentProject(input),
  ),
  list: os.projects.list.handler(({ context, input }) =>
    context.store.projects.list(input),
  ),
  update: os.projects.update.handler(({ context, input }) =>
    context.store.projects.update(input),
  ),
};

export const router = os.router({
  projects: projectsRouter,
});

export type MarbleRouter = typeof router;
