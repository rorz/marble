import { createORPCResourceContract } from "./orpc";
import { captureOperations } from "./resources/entities/capture";
import { contractOperations } from "./resources/entities/contract";
import { coverageOperations } from "./resources/entities/coverage";
import { modelOperations } from "./resources/entities/model";
import { projectOperations } from "./resources/entities/project";

export type {
  ApiModel,
  CoverageDelta,
  CoverageMap,
  CoverageSurface,
  CoverageTile,
  CoverageTileState,
  EndpointModel,
  SchemaNode,
} from "@harp/core";

export const harpContract = {
  captures: createORPCResourceContract(captureOperations),
  contract: createORPCResourceContract(contractOperations),
  coverage: createORPCResourceContract(coverageOperations),
  model: createORPCResourceContract(modelOperations),
  projects: createORPCResourceContract(projectOperations),
};

export type HarpContract = typeof harpContract;
