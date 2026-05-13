import "server-only";
import {
  listProgramSecretDeclarationsFromFiles,
  type ProgramManifestSecretDeclaration,
  parseProgramSecretConfig,
} from "@marble/contracts";
import type { MarbleClient } from "@marble/sdk";
import { createServerMarbleSdk } from "./marble-sdk-server";

type SecretRecord = Awaited<
  ReturnType<MarbleClient["secrets"]["list"]>
>[number];
type ProgramFileLike = {
  content: string;
  filename: string;
};
export type SecretBindingMap = Record<string, Record<string, string>>;

type ProgramWithVersionsLike = {
  id: string;
  programVersions: Array<{
    programFiles: ProgramFileLike[] | null;
    secretConfig: unknown;
    version: number | null;
  }>;
};

const getLatestPublishedProgramVersion = (program: ProgramWithVersionsLike) => {
  return (
    [
      ...program.programVersions,
    ]
      .filter((version) => version.version !== null)
      .sort((left, right) => (right.version ?? 0) - (left.version ?? 0))[0] ??
    null
  );
};

export const listSecretsForUser = async (_userId: string) => {
  const sdk = await createServerMarbleSdk();
  return (await sdk.secrets.list({})) satisfies SecretRecord[];
};

export const listProgramSecretBindingsForUser = async (
  _userId: string,
  programIds: string[],
) => {
  if (programIds.length === 0) {
    return {} satisfies SecretBindingMap;
  }

  const sdk = await createServerMarbleSdk();
  return sdk.secretBindings.listPrograms({
    programIds,
  });
};

export const listColumnSecretBindings = async (columnIds: string[]) => {
  if (columnIds.length === 0) {
    return {} satisfies SecretBindingMap;
  }

  const sdk = await createServerMarbleSdk();
  return sdk.secretBindings.listColumns({
    columnIds,
  });
};

export const listLatestProgramSecretDeclarationsByProgramId = (
  programs: ProgramWithVersionsLike[],
) => {
  return Object.fromEntries(
    programs.map((program) => {
      const latestVersion = getLatestPublishedProgramVersion(program);

      return [
        program.id,
        latestVersion?.secretConfig === null ||
        latestVersion?.secretConfig === undefined
          ? listProgramSecretDeclarationsFromFiles(
              latestVersion?.programFiles ?? [],
            )
          : parseProgramSecretConfig(latestVersion.secretConfig),
      ];
    }),
  ) as Record<string, ProgramManifestSecretDeclaration[]>;
};
