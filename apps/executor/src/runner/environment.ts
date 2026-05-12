import { type JsonValue, parseProgramSecretConfig } from "@marble/contracts";
import type { MarbleStore, StoredProgramRun } from "@marble/store";
import { MissingSecretConfigurationError } from "./failure-state";

type ExecutorAuthContext =
  | {
      profileId?: string;
      userId?: string;
    }
  | undefined;

export type ProgramRunRuntimeStore = {
  programRuns: Pick<
    MarbleStore["programRuns"],
    | "listDependentCandidateCellIds"
    | "loadInputContextForCellId"
    | "loadInputContextForRun"
    | "resolveEnvironmentVariablesForSecretDeclarations"
    | "resolveOwnerUserIdForProfile"
    | "setCellState"
  >;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

function ownerUserIdForRun(run: StoredProgramRun) {
  const row = firstRelation(run.cell.row);
  const table = firstRelation(row?.table);
  const project = firstRelation(table?.project);
  const profile = firstRelation(project?.profile);

  if (!profile?.owner_user_id) {
    throw new Error("Could not resolve the run owner for secret loading.");
  }

  return profile.owner_user_id;
}

async function resolveDeclaredEnvironmentVariables(
  store: ProgramRunRuntimeStore,
  input: {
    columnId?: string;
    ownerUserId: string;
    programId: string;
    secretConfig?: JsonValue | null;
  },
) {
  const declarations =
    input.secretConfig === undefined || input.secretConfig === null
      ? []
      : parseProgramSecretConfig(input.secretConfig);
  const resolved =
    await store.programRuns.resolveEnvironmentVariablesForSecretDeclarations({
      columnId: input.columnId,
      declarations,
      ownerUserId: input.ownerUserId,
      programId: input.programId,
    });

  if (resolved.missingSecrets.length > 0) {
    throw new MissingSecretConfigurationError(resolved.missingSecrets);
  }

  return resolved.environmentVariables;
}

export function resolveEnvironmentVariablesForRun(
  store: ProgramRunRuntimeStore,
  run: StoredProgramRun,
) {
  return resolveDeclaredEnvironmentVariables(store, {
    columnId: run.cell.column_id,
    ownerUserId: ownerUserIdForRun(run),
    programId: run.program_version.program_id,
    secretConfig: run.program_version.secret_config as JsonValue | null,
  });
}

export async function resolveEnvironmentVariablesForProgramVersion(
  store: ProgramRunRuntimeStore,
  options: {
    auth: ExecutorAuthContext;
    programId: string;
    secretConfig?: JsonValue | null;
  },
) {
  const ownerUserId =
    options.auth?.userId ??
    (options.auth?.profileId
      ? await store.programRuns.resolveOwnerUserIdForProfile(
          options.auth.profileId,
        )
      : undefined);

  if (!ownerUserId) {
    return {};
  }

  return resolveDeclaredEnvironmentVariables(store, {
    ownerUserId,
    programId: options.programId,
    secretConfig: options.secretConfig,
  });
}
