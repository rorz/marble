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

export async function listProgramsForUser(
  _userId: string,
): Promise<FullProgram[]> {
  const sdk = await createServerMarbleSdk();
  return hydrateEditorPrograms(await sdk.programs.listForEditor({}));
}

export async function loadProgramsPageDataForUser(
  userId: string,
): Promise<ProgramsPageData> {
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
}

export async function listPrograms() {
  const user = await requireUser();
  return listProgramsForUser(user.id);
}

async function patchProgramVersion(
  sdk: ServerMarbleSdk,
  programVersionId: string,
  body: {
    inputSchema?: unknown;
    outputConfig?: unknown;
    publish?: boolean;
    secretConfig?: ProgramSecretConfig;
  },
) {
  return sdk.programVersions.update({
    id: programVersionId,
    values: body,
  });
}

export async function createDraftVersion(
  programId: string,
  inputSchema: unknown,
  outputConfig: unknown,
  files: EditableProgramFile[],
  secretConfig: ProgramSecretConfig,
) {
  const sdk = await createServerMarbleSdk();
  const version = await sdk.programVersions.create({
    inputSchema,
    outputConfig,
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
}

export async function syncDraftVersion(
  programVersionId: string,
  inputSchema: unknown,
  outputConfig: unknown,
  files: EditableProgramFile[],
  secretConfig: ProgramSecretConfig,
) {
  const sdk = await createServerMarbleSdk();
  const version = await patchProgramVersion(sdk, programVersionId, {
    inputSchema,
    outputConfig,
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
}

export async function publishDraftVersion(
  programVersionId: string,
  inputSchema: unknown,
  outputConfig: unknown,
  files: EditableProgramFile[],
  secretConfig: ProgramSecretConfig,
) {
  const sdk = await createServerMarbleSdk();
  await sdk.programFiles.syncForVersion({
    files,
    versionId: programVersionId,
  });
  const version = await patchProgramVersion(sdk, programVersionId, {
    inputSchema,
    outputConfig,
    publish: true,
    secretConfig,
  });

  return {
    ...version,
    programFiles: await sdk.programFiles.list({
      versionId: programVersionId,
    }),
  };
}

export async function testProgram(
  programVersionId: string,
  inputConfig: Record<string, unknown>,
  manualInput?: string,
): Promise<{
  detail?: unknown;
  error?: string;
  errorType?: string;
  ok: boolean;
  output: unknown;
}> {
  const sdk = await createServerMarbleSdk();

  return sdk.programVersions.test({
    inputConfig,
    manualInput,
    programVersionId,
  });
}

export async function updateProgramSecretBindings(
  programId: string,
  bindings: SecretBindingInput[],
) {
  const sdk = await createServerMarbleSdk();
  return sdk.secretBindings.setProgram({
    bindings,
    programId,
  });
}
