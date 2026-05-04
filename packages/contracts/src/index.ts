import { createORPCResourceContract } from "./helpers";
import { pipeOperations } from "./resources/entities/pipe";
import { projectOperations } from "./resources/entities/project";
import { sourceOperations } from "./resources/entities/source";
import { sourceEventOperations } from "./resources/entities/source_event";
import { tableOperations } from "./resources/entities/table";

export const marbleContract = {
  pipes: createORPCResourceContract(pipeOperations),
  projects: createORPCResourceContract(projectOperations),
  sourceEvents: createORPCResourceContract(sourceEventOperations),
  sources: createORPCResourceContract(sourceOperations),
  tables: createORPCResourceContract(tableOperations),
};

export type MarbleContract = typeof marbleContract;
