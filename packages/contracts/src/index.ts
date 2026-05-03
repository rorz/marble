import { createORPCResourceContract } from "./helpers";
import { projectOperations } from "./resources/projects";
import { tableOperations } from "./resources/table";

export const marbleContract = {
  projects: createORPCResourceContract(projectOperations),
  tables: createORPCResourceContract(tableOperations),
};

export type MarbleContract = typeof marbleContract;
