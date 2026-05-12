import type { Json, Tables } from "@marble/supabase";
import type { ResourceDeps } from "../../db";
import { listDependentCandidateCellIds } from "./dependents";
import {
  createExecutionInputContextFromStoredRun,
  loadExecutionInputContextForCell,
  loadInputContext,
} from "./input-context";
import { requireServiceSupabase, type StoredProgramRun } from "./load";
import {
  createPendingForCellIds,
  persistFailure,
  persistSuccess,
  setCellState,
} from "./persistence";
import {
  type ProgramSecretDeclaration,
  resolveDeclaredEnvironmentVariables,
  resolveOwnerUserIdForProfile,
} from "./secret-bindings";

export type { ProgramRunInputContext } from "./input-context";
export type { StoredProgramRun } from "./load";

type ProgramFile = Pick<
  Tables<"program_file">,
  "content" | "filename" | "filetype"
>;

export type ProgramVersionTestData = {
  files: ProgramFile[];
  outputConfig: Json;
  programId: string;
  secretConfig: Json | null;
};

export class ProgramRunCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  private readonly supabase = () => requireServiceSupabase(this.deps);

  public readonly createPendingForCellIds = async (cellIds: string[]) => {
    return createPendingForCellIds(this.supabase(), cellIds);
  };

  public readonly loadMany = async (runIds: string[]) => {
    const supabase = this.supabase();
    const uniqueRunIds = Array.from(new Set(runIds));

    if (uniqueRunIds.length === 0) {
      return [] as StoredProgramRun[];
    }

    const { data, error } = await supabase
      .from("program_run")
      .select(
        "*, program_version(*, program!program_version_program_id_fkey(*), program_file(*)), cell!target_cell_id(*, row!cell_row_id_fkey(*, table!row_table_id_fkey(*, project!table_project_id_fkey(*, profile!project_owner_profile_id_fkey(*)))), column!cell_column_id_fkey(*))",
      )
      .in("id", uniqueRunIds);

    if (error) {
      throw new Error(error.message);
    }

    const runsById = new Map(
      (data ?? []).map((run) => [
        run.id,
        run,
      ]),
    );

    for (const runId of uniqueRunIds) {
      if (!runsById.has(runId)) {
        throw new Error(`No run found for '${runId}'.`);
      }
    }

    return runIds.map((runId) => {
      const run = runsById.get(runId);

      if (!run) {
        throw new Error(`No run found for '${runId}'.`);
      }

      return run;
    });
  };

  public readonly persistFailure = async (
    run: StoredProgramRun,
    failState: Json,
  ) => {
    return persistFailure(this.supabase(), run, failState);
  };

  public readonly persistSuccess = async (input: {
    output: Json;
    parsedInput: Json;
    run: StoredProgramRun;
  }) => {
    return persistSuccess(this.supabase(), input);
  };

  public readonly loadInputContextForRun = async (run: StoredProgramRun) => {
    return loadInputContext(
      this.supabase(),
      createExecutionInputContextFromStoredRun(run),
    );
  };

  public readonly loadInputContextForCellId = async (cellId: string) => {
    return loadInputContext(
      this.supabase(),
      await loadExecutionInputContextForCell(this.supabase(), cellId),
    );
  };

  public readonly setCellState = async (input: {
    cellId: string;
    state: Json;
  }) => {
    return setCellState(this.supabase(), input);
  };

  public readonly listDependentCandidateCellIds = async (input: {
    requestId?: string;
    successfulRuns: StoredProgramRun[];
    visitedCellIds: Set<string>;
  }) => {
    return listDependentCandidateCellIds(this.supabase(), input);
  };

  public readonly resolveOwnerUserIdForProfile = (profileId: string) =>
    resolveOwnerUserIdForProfile(this.supabase(), profileId);

  public readonly resolveEnvironmentVariablesForSecretDeclarations = (options: {
    columnId?: string;
    declarations: ProgramSecretDeclaration[];
    ownerUserId: string;
    programId: string;
  }) => {
    return resolveDeclaredEnvironmentVariables(this.supabase(), options);
  };

  private readonly loadProgramVersionFiles = async (
    programVersionId: string,
  ): Promise<ProgramFile[]> => {
    const { data, error } = await this.supabase()
      .from("program_file")
      .select("*")
      .eq("version_id", programVersionId);

    if (error) {
      throw new Error(error.message);
    }

    return data ?? [];
  };

  public readonly loadProgramVersionTestData = async (
    programVersionId: string,
  ): Promise<ProgramVersionTestData> => {
    const [files, versionRecord] = await Promise.all([
      this.loadProgramVersionFiles(programVersionId),
      this.supabase()
        .from("program_version")
        .select("output_config, program_id, secret_config")
        .eq("id", programVersionId)
        .maybeSingle(),
    ]);

    if (versionRecord.error) {
      throw new Error(versionRecord.error.message);
    }

    if (!versionRecord.data) {
      throw new Error(`Program version '${programVersionId}' was not found`);
    }

    return {
      files,
      outputConfig: versionRecord.data.output_config,
      programId: versionRecord.data.program_id,
      secretConfig: versionRecord.data.secret_config,
    };
  };
}
