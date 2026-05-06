import "server-only";
import type { MarbleClient } from "@marble/sdk";
import { createServerMarbleSdk } from "./marble-sdk-server";
import {
  listProgramSecretDeclarationsFromFiles,
  type ProgramManifestSecretDeclaration,
  parseProgramSecretConfig,
} from "./program-manifest";

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

function getLatestPublishedProgramVersion(program: ProgramWithVersionsLike) {
  return (
    [
      ...program.programVersions,
    ]
      .filter((version) => version.version !== null)
      .sort((left, right) => (right.version ?? 0) - (left.version ?? 0))[0] ??
    null
  );
}

export async function listSecretsForUser(_userId: string) {
  const sdk = await createServerMarbleSdk();
  return (await sdk.secrets.list({})) satisfies SecretRecord[];
}

export async function listProgramSecretBindingsForUser(
  _userId: string,
  programIds: string[],
) {
  if (programIds.length === 0) {
    return {} satisfies SecretBindingMap;
  }

  const sdk = await createServerMarbleSdk();
  return sdk.secretBindings.listPrograms({
    programIds,
  });
}

export async function listColumnSecretBindings(columnIds: string[]) {
  if (columnIds.length === 0) {
    return {} satisfies SecretBindingMap;
  }

  const sdk = await createServerMarbleSdk();
  return sdk.secretBindings.listColumns({
    columnIds,
  });
}

export function listLatestProgramSecretDeclarationsByProgramId(
  programs: ProgramWithVersionsLike[],
) {
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
}
