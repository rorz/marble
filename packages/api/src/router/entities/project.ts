import { os } from "../../server";
import type { RouterResourcePart } from "../../types";
import { composeResourceRouter } from "../compose";

export const projectRouter = {
  ...composeResourceRouter("projects"),
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
} satisfies RouterResourcePart<"projects">;
