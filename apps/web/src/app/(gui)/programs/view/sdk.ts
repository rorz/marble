import { stringifyPretty } from "@marble/lib/json";
import type { MarbleClient } from "@marble/sdk";
import type { ProgramVersionMutation, ProgramVersionWithFiles } from "./types";

export const normalizeJsonEditorValue = (value: string) => {
  try {
    return stringifyPretty(JSON.parse(value));
  } catch {
    return null;
  }
};

export const normalizeProgramVersionMutation = (
  version: ProgramVersionMutation | ProgramVersionWithFiles,
) => {
  return version satisfies ProgramVersionWithFiles;
};

export const renameProgram = (
  sdk: MarbleClient,
  programId: string,
  name: string,
) => {
  return sdk.programs.update({
    id: programId,
    values: {
      name,
    },
  });
};
