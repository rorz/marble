import { columnRouter } from "../column";
import { os } from "../server";
import { cellRouter } from "./cell";
import { eventRouter } from "./event";
import { keyRouter } from "./key";
import { pipeRouter } from "./pipe";
import { profileRouter } from "./profile";
import { programRouter } from "./program";
import { programFileRouter } from "./program-file";
import { programVersionRouter } from "./program-version";
import { projectRouter } from "./project";
import { rowRouter } from "./row";
import { secretRouter } from "./secret";
import { secretBindingRouter } from "./secret-binding";
import { sidebarRouter } from "./sidebar";
import { sourceRouter } from "./source";
import { sourceEventRouter } from "./source-event";
import { tableRouter } from "./table";

export const marbleRouter = os.router({
  cells: cellRouter,
  columns: columnRouter,
  events: eventRouter,
  keys: keyRouter,
  pipes: pipeRouter,
  profiles: profileRouter,
  programFiles: programFileRouter,
  programs: programRouter,
  programVersions: programVersionRouter,
  projects: projectRouter,
  rows: rowRouter,
  secretBindings: secretBindingRouter,
  secrets: secretRouter,
  sidebar: sidebarRouter,
  sourceEvents: sourceEventRouter,
  sources: sourceRouter,
  tables: tableRouter,
});
