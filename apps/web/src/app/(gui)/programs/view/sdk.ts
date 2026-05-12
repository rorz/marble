import type { MarbleClient } from "@marble/sdk";
import type {
  ProgramVersionMutation,
  ProgramVersionWithFiles,
  SecretBindingInput,
} from "./types";

export function normalizeJsonEditorValue(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return null;
  }
}

export function normalizeProgramVersionMutation(
  version: ProgramVersionMutation | ProgramVersionWithFiles,
) {
  return version satisfies ProgramVersionWithFiles;
}

export function renameProgram(
  sdk: MarbleClient,
  programId: string,
  name: string,
) {
  return sdk.programs.update({
    id: programId,
    values: {
      name,
    },
  });
}

export function updateProgramSecretBindings(
  sdk: MarbleClient,
  programId: string,
  bindings: SecretBindingInput[],
) {
  return sdk.secretBindings.setProgram({
    bindings,
    programId,
  });
}
