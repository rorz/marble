import type { MarbleClient } from "@marble/sdk";
import type {
  Column,
  ColumnRecord,
  Program,
  RunExecutionResult,
  SecretBindingInput,
} from "./types";

export function deleteColumn(sdk: MarbleClient, columnId: string) {
  return sdk.columns.delete({
    id: columnId,
  });
}

export function deleteRow(sdk: MarbleClient, rowId: string) {
  return sdk.rows.delete({
    id: rowId,
  });
}

export function executeRun(
  sdk: MarbleClient,
  input: {
    cellId: string;
    cellValue?: string;
  },
): Promise<RunExecutionResult> {
  return sdk.cells.run({
    id: input.cellId,
    ...(input.cellValue === undefined
      ? {}
      : {
          manualInput: input.cellValue,
        }),
  });
}

function findProgramVersionForColumn(
  programs: Program[],
  programVersionId: string,
): Column["programVersion"] | null {
  for (const program of programs) {
    for (const version of program.programVersions ?? []) {
      if (version.id === programVersionId) {
        return {
          ...version,
          program,
        };
      }
    }
  }

  return null;
}

export function hydrateColumnRecord(
  column: ColumnRecord,
  programs: Program[],
): Column {
  return {
    ...column,
    programVersion: findProgramVersionForColumn(
      programs,
      column.programVersionId,
    ),
  };
}

export function createColumn(
  sdk: MarbleClient,
  input: {
    inputTemplate: string;
    name: string;
    programVersionId: string;
    runCondition: boolean;
    tableId: string;
  },
) {
  return sdk.columns.create({
    inputTemplate: input.inputTemplate,
    name: input.name,
    programVersionId: input.programVersionId,
    runCondition: input.runCondition,
    tableId: input.tableId,
  });
}

export function updateColumn(
  sdk: MarbleClient,
  input: {
    columnId: string;
    inputTemplate?: string;
    name?: string;
    programVersionId?: string;
    runCondition?: boolean;
  },
) {
  return sdk.columns.update({
    id: input.columnId,
    values: {
      ...(input.inputTemplate === undefined
        ? {}
        : {
            inputTemplate: input.inputTemplate,
          }),
      ...(input.name === undefined
        ? {}
        : {
            name: input.name,
          }),
      ...(input.programVersionId === undefined
        ? {}
        : {
            programVersionId: input.programVersionId,
          }),
      ...(input.runCondition === undefined
        ? {}
        : {
            runCondition: input.runCondition,
          }),
    },
  });
}

export function updateColumnSecretBindings(
  sdk: MarbleClient,
  columnId: string,
  bindings: SecretBindingInput[],
) {
  return sdk.secretBindings.setColumn({
    bindings,
    columnId,
  });
}
