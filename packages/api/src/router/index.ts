import { os } from "../server";
import { projectRouter } from "./project";
import { tableRouter } from "./table";

export const marbleRouter = os.router({
  projects: projectRouter,
  tables: tableRouter,
});
type MarbleRouter = typeof marbleRouter;
