import { os } from "../server";
import { projectRouter } from "./project";
import { tableRouter } from "./table";

export const marbleRouter = os.router({
  projects: projectRouter,
  tables: tableRouter,
});
export type MarbleRouter = typeof marbleRouter;
