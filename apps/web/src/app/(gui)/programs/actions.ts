"use server";

import type { ProgramSecretConfig } from "@marble/contracts";
import { requireUser } from "../../../lib/auth";
import { createServerMarbleSdk } from "../../../lib/marble-sdk-server";
import {
  type EditableProgramFile,
  type FullProgram,
  hydrateEditorPrograms,
} from "../../../lib/program-data";
import {
  listProgramSecretBindingsForUser,
  listSecretsForUser,
  type SecretBindingMap,
} from "../../../lib/secret-data";

type ServerMarbleSdk = Awaited<ReturnType<typeof createServerMarbleSdk>>;
export type ProgramsPageData = {
  programSecretBindings: SecretBindingMap;
  programs: FullProgram[];
  secrets: Awaited<ReturnType<typeof listSecretsForUser>>;
};
type SecretBindingInput = {
  envName: string;
  secretId: string;
};

const listProgramsForUser = async (_userId: string): Promise<FullProgram[]> => {
  const sdk = await createServerMarbleSdk();
  return hydrateEditorPrograms(await sdk.programs.listForEditor({}));
};

export const loadProgramsPageDataForUser = async (
  userId: string,
): Promise<ProgramsPageData> => {
  const programs = await listProgramsForUser(userId);
  const [secrets, programSecretBindings] = await Promise.all([
    listSecretsForUser(userId),
    listProgramSecretBindingsForUser(
      userId,
      programs.map((program) => program.id),
    ),
  ]);

  return {
    programSecretBindings,
    programs,
    secrets,
  };
};

export const listPrograms = async () => {
  const user = await requireUser();
  return listProgramsForUser(user.id);
};

const patchProgramVersion = async (
  sdk: ServerMarbleSdk,
  programVersionId: string,
  body: {
    publish?: boolean;
    secretConfig?: ProgramSecretConfig;
  },
) => {
  return sdk.programVersions.update({
    id: programVersionId,
    values: body,
  });
};

export const createDraftVersion = async (
  programId: string,
  files: EditableProgramFile[],
  secretConfig: ProgramSecretConfig,
) => {
  const sdk = await createServerMarbleSdk();
  const version = await sdk.programVersions.create({
    programId,
    publish: false,
    secretConfig,
  });
  const programFiles = await sdk.programFiles.syncForVersion({
    files,
    versionId: version.id,
  });

  return {
    programId,
    version: {
      ...version,
      programFiles,
    },
  };
};

export const syncDraftVersion = async (
  programVersionId: string,
  files: EditableProgramFile[],
  secretConfig: ProgramSecretConfig,
) => {
  const sdk = await createServerMarbleSdk();
  const version = await patchProgramVersion(sdk, programVersionId, {
    secretConfig,
  });
  const programFiles = await sdk.programFiles.syncForVersion({
    files,
    versionId: programVersionId,
  });

  return {
    ...version,
    programFiles,
  };
};

export const publishDraftVersion = async (
  programVersionId: string,
  files: EditableProgramFile[],
  secretConfig: ProgramSecretConfig,
) => {
  const sdk = await createServerMarbleSdk();
  await sdk.programFiles.syncForVersion({
    files,
    versionId: programVersionId,
  });
  const version = await patchProgramVersion(sdk, programVersionId, {
    publish: true,
    secretConfig,
  });

  return {
    ...version,
    programFiles: await sdk.programFiles.list({
      versionId: programVersionId,
    }),
  };
};

export const testProgram = async (
  programVersionId: string,
  inputConfig: Record<string, unknown>,
  manualInput?: string,
): Promise<{
  detail?: unknown;
  error?: string;
  errorType?: string;
  ok: boolean;
  output: unknown;
}> => {
  const sdk = await createServerMarbleSdk();

  return sdk.programVersions.test({
    inputConfig,
    manualInput,
    programVersionId,
  });
};

export const updateProgramSecretBindings = async (
  programId: string,
  bindings: SecretBindingInput[],
) => {
  const sdk = await createServerMarbleSdk();
  return sdk.secretBindings.setProgram({
    bindings,
    programId,
  });
};
