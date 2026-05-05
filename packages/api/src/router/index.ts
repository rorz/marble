import { os } from "../server";
import { columnRouter } from "./column";
import { pipeRouter } from "./pipe";
import { projectRouter } from "./project";
import { sourceRouter } from "./source";
import { sourceEventRouter } from "./source-event";
import { tableRouter } from "./table";

export const marbleRouter = os.router({
  columns: columnRouter,
  pipes: pipeRouter,
  projects: projectRouter,
  sourceEvents: sourceEventRouter,
  sources: sourceRouter,
  tables: tableRouter,
});
