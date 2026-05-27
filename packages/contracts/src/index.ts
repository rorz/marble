import { createORPCResourceContract } from "./orpc";
import { cellOperations } from "./resources/entities/cell";
import { columnOperations } from "./resources/entities/column";
import { eventOperations } from "./resources/entities/event";
import { keyOperations } from "./resources/entities/key";
import { pipeOperations } from "./resources/entities/pipe";
import { profileOperations } from "./resources/entities/profile";
import { programOperations } from "./resources/entities/program";
import { programFileOperations } from "./resources/entities/program-file";
import { programVersionOperations } from "./resources/entities/program-version";
import { projectOperations } from "./resources/entities/project";
import { rowOperations } from "./resources/entities/row";
import { secretOperations } from "./resources/entities/secret";
import { secretBindingOperations } from "./resources/entities/secret-binding";
import { sidebarOperations } from "./resources/entities/sidebar";
import { sourceOperations } from "./resources/entities/source";
import { sourceEventOperations } from "./resources/entities/source-event";
import { tableOperations } from "./resources/entities/table";

export type { JsonValue } from "./resources/base";
export {
  ColumnOutputSchema,
  type ColumnOutputSchema as ColumnOutputSchemaType,
  ColumnRunCondition,
  type ColumnRunCondition as ColumnRunConditionType,
  resolveColumnConfig,
  resolveColumnOutputSchema,
} from "./resources/entities/column";
export {
  ENVIRONMENT_VARIABLE_NAME_PATTERN,
  listProgramSecretDeclarationsFromFiles,
  listProgramSecretDeclarationsFromManifest,
  PROGRAM_CONFIG_FILENAME,
  type ProgramConfig,
  ProgramConfigSchema,
  type ProgramManifest,
  type ProgramManifestSecretDeclaration,
  type ProgramSecretConfig,
  ProgramSecretConfigSchema,
  ProgramSecretDeclarationSchema,
  parseProgramConfig,
  parseProgramConfigFileContent,
  parseProgramConfigFromFiles,
  parseProgramManifest,
  parseProgramManifestFileContent,
  parseProgramSecretConfig,
} from "./resources/entities/program";
export {
  JsonSchema,
  ProgramInputSchema,
  type ProgramInputSchema as ProgramInputSchemaType,
  ProgramOutputConfig,
  type ProgramOutputConfig as ProgramOutputConfigType,
  RunInput,
  type RunInput as RunInputType,
  RunReturnValue,
  type RunReturnValue as RunReturnValueType,
} from "./resources/entities/program-version";

export const marbleContract = {
  cells: createORPCResourceContract(cellOperations),
  columns: createORPCResourceContract(columnOperations),
  events: createORPCResourceContract(eventOperations),
  keys: createORPCResourceContract(keyOperations),
  pipes: createORPCResourceContract(pipeOperations),
  profiles: createORPCResourceContract(profileOperations),
  programFiles: createORPCResourceContract(programFileOperations),
  programs: createORPCResourceContract(programOperations),
  programVersions: createORPCResourceContract(programVersionOperations),
  projects: createORPCResourceContract(projectOperations),
  rows: createORPCResourceContract(rowOperations),
  secretBindings: createORPCResourceContract(secretBindingOperations),
  secrets: createORPCResourceContract(secretOperations),
  sidebar: createORPCResourceContract(sidebarOperations),
  sourceEvents: createORPCResourceContract(sourceEventOperations),
  sources: createORPCResourceContract(sourceOperations),
  tables: createORPCResourceContract(tableOperations),
};

const { sidebar: _sidebarContract, ...marbleCliContract } = marbleContract;

export { marbleCliContract };

export type MarbleContract = typeof marbleContract;

export const marbleOperations = {
  cells: cellOperations,
  columns: columnOperations,
  events: eventOperations,
  keys: keyOperations,
  pipes: pipeOperations,
  profiles: profileOperations,
  programFiles: programFileOperations,
  programs: programOperations,
  programVersions: programVersionOperations,
  projects: projectOperations,
  rows: rowOperations,
  secretBindings: secretBindingOperations,
  secrets: secretOperations,
  sourceEvents: sourceEventOperations,
  sources: sourceOperations,
  tables: tableOperations,
} as const;

export type MarbleOperations = typeof marbleOperations;
