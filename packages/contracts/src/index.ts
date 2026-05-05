import { createORPCResourceContract } from "./helpers";
import { columnOperations } from "./resources/entities/column";
import { pipeOperations } from "./resources/entities/pipe";
import { projectOperations } from "./resources/entities/project";
import { sourceOperations } from "./resources/entities/source";
import { sourceEventOperations } from "./resources/entities/source_event";
import { tableOperations } from "./resources/entities/table";

export const marbleContract = {
  columns: createORPCResourceContract(columnOperations),
  pipes: createORPCResourceContract(pipeOperations),
  projects: createORPCResourceContract(projectOperations),
  sourceEvents: createORPCResourceContract(sourceEventOperations),
  sources: createORPCResourceContract(sourceOperations),
  tables: createORPCResourceContract(tableOperations),
};

export type MarbleContract = typeof marbleContract;
