import { ORPCError } from "@orpc/server";
import { type HarpContext, os } from "./server";
import type { Project } from "./store";

/**
 * The implemented control-plane router. Handlers stay thin: validate the
 * project exists, then forward to the filesystem store (which owns the
 * reverse-engineering pipeline). Mirrors the Marble router's pass-through shape.
 */

const requireProject = async (
  context: HarpContext,
  projectId: string,
): Promise<Project> => {
  const project = await context.store.getProject(projectId);
  if (!project) {
    throw new ORPCError("NOT_FOUND", {
      message: `Unknown project '${projectId}'.`,
    });
  }
  return project;
};

const projectsRouter = {
  create: os.projects.create.handler(({ context, input }) =>
    context.store.createProject(input),
  ),
  get: os.projects.get.handler(({ context, input }) =>
    requireProject(context, input.id),
  ),
  list: os.projects.list.handler(({ context }) => context.store.listProjects()),
};

const capturesRouter = {
  ingest: os.captures.ingest.handler(async ({ context, input }) => {
    const project = await requireProject(context, input.projectId);
    return context.store.ingest(project, input.har);
  }),
  list: os.captures.list.handler(async ({ context, input }) => {
    await requireProject(context, input.projectId);
    return context.store.listCaptures(input.projectId);
  }),
};

const modelRouter = {
  get: os.model.get.handler(async ({ context, input }) => {
    await requireProject(context, input.projectId);
    const model = await context.store.getModel(input.projectId);
    if (!model) {
      throw new ORPCError("NOT_FOUND", {
        message: "No model yet — ingest a capture first.",
      });
    }
    return model;
  }),
};

const coverageRouter = {
  get: os.coverage.get.handler(async ({ context, input }) => {
    await requireProject(context, input.projectId);
    const coverage = await context.store.getCoverage(input.projectId);
    if (!coverage) {
      throw new ORPCError("NOT_FOUND", {
        message: "No coverage yet — ingest a capture first.",
      });
    }
    return coverage;
  }),
};

const contractRouter = {
  get: os.contract.get.handler(async ({ context, input }) => {
    await requireProject(context, input.projectId);
    const source = await context.store.getContractSource(input.projectId);
    if (source === null) {
      throw new ORPCError("NOT_FOUND", {
        message: "No contract yet — ingest a capture first.",
      });
    }
    return {
      source,
    };
  }),
};

export const harpRouter = os.router({
  captures: capturesRouter,
  contract: contractRouter,
  coverage: coverageRouter,
  model: modelRouter,
  projects: projectsRouter,
});
