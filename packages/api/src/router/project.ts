import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const projectRouter = {
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
    async ({ context }) => {
      const projects = await context.store.projects.list(
        {},
        {
          limit: 1,
          orderBy: [
            {
              ascending: false,
              column: "createdAt",
            },
            {
              ascending: false,
              column: "id",
            },
          ],
        },
      );

      return projects[0] ?? null;
    },
  ),
  list: os.projects.list.handler(({ context, input }) =>
    context.store.projects.list(input),
  ),
  update: os.projects.update.handler(({ context, input }) =>
    context.store.projects.update(input),
  ),
} satisfies RouterResourcePart<"projects">;
