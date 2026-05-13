import { os } from "../server";
import { cellRouter } from "./entities/cell";
import { columnRouter } from "./entities/column";
import { eventRouter } from "./entities/event";
import { keyRouter } from "./entities/key";
import { pipeRouter } from "./entities/pipe";
import { profileRouter } from "./entities/profile";
import { programRouter } from "./entities/program";
import { programFileRouter } from "./entities/program-file";
import { programVersionRouter } from "./entities/program-version";
import { projectRouter } from "./entities/project";
import { rowRouter } from "./entities/row";
import { secretRouter } from "./entities/secret";
import { secretBindingRouter } from "./entities/secret-binding";
import { sidebarRouter } from "./entities/sidebar";
import { sourceRouter } from "./entities/source";
import { sourceEventRouter } from "./entities/source-event";
import { tableRouter } from "./entities/table";

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
