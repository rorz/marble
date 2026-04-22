import type { Sandbox } from "@cloudflare/sandbox";
import { type JsonValue, resolveColumnConfig, Schemas } from "@marble/core";
import { assert } from "@marble/lib/assert";
import type { Json, SupabaseClient, Tables } from "@marble/supabase";
import { z } from "zod";
import {
  BATCH_EXECUTOR_FILE_CONTENT,
  EXECUTOR_FILE_CONTENT,
} from "./constants";

type ProgramFile = Pick<
  Tables<"program_file">,
  "content" | "filename" | "filetype"
>;
type ExecutionSecret = {
  category: Tables<"secret">["category"];
  name: string;
  value: string;
};
type BatchExecutionJob = {
  key: string;
  runInput: JsonValue;
};
type BatchExecutionResult = {
  key: string;
  output: Schemas.RunReturnValue;
};
type BatchExecutorItem = {
  error?: Json;
  key: string;
  ok: boolean;
  value?: JsonValue;
};
type BatchExecutorEnvelope = {
  results: BatchExecutorItem[];
};

const executionSecretSchema = z.object({
  category: z.enum([
    "Managed",
    "UserDefined",
  ]),
  name: z.string(),
  value: z.string(),
});

export const formatZodIssues = (issues: z.ZodIssue[]): string =>
  issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");

export const createFailureState = (
  errorType: string,
  message: string,
  detail?: Json,
): Schemas.RunReturnValue => ({
  error: {
    type: errorType,
    ...(detail == null
      ? {}
      : {
          detail: detail as unknown as JsonValue,
        }),
  },
  message,
  ok: false,
});

export const failureStateFromError = (
  error: unknown,
): Schemas.RunReturnValue => {
  if (error instanceof z.ZodError) {
    return createFailureState(
      "Validation",
      formatZodIssues(error.issues),
      error.issues as unknown as Json,
    );
  }

  return createFailureState(
    "Unhandled",
    error instanceof Error
      ? error.message
      : `Unexpected error: ${String(error)}`,
  );
};

const batchExecutorEnvelopeSchema: z.ZodType<BatchExecutorEnvelope> = z.object({
  results: z.array(
    z.object({
      error: z.json().optional(),
      key: z.string(),
      ok: z.boolean(),
      value: z.json().optional(),
    }),
  ),
});

function createRuntimeEnvelope(
  input: JsonValue,
  manualInputValue?: string | null,
): JsonValue {
  return {
    cell:
      manualInputValue == null
        ? {}
        : {
            manualInputValue,
          },
    input,
    system: {},
  };
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

async function listSecretsForOwnerUserId(
  supabase: SupabaseClient,
  ownerUserId: string,
) {
  const { data, error } = await supabase.rpc("secret_store_resolve", {
    p_owner_user_id: ownerUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(executionSecretSchema).parse(data ?? []) as ExecutionSecret[];
}

function secretsToEnvironmentVariables(
  secrets: ExecutionSecret[],
): Record<string, string> {
  const managedEnv: Record<string, string> = {};
  const userEnv: Record<string, string> = {};

  for (const secret of secrets) {
    if (secret.category === "Managed") {
      managedEnv[secret.name] = secret.value;
      continue;
    }

    userEnv[secret.name] = secret.value;
  }

  return {
    ...managedEnv,
    ...userEnv,
  };
}

async function resolveOwnerUserIdForProfile(
  supabase: SupabaseClient,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("profile")
    .select("owner_user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`Profile '${profileId}' was not found.`);
  }

  return data.owner_user_id;
}

async function resolveEnvironmentVariablesForOwnerUserId(
  supabase: SupabaseClient,
  ownerUserId?: string,
) {
  if (!ownerUserId) {
    return {};
  }

  return secretsToEnvironmentVariables(
    await listSecretsForOwnerUserId(supabase, ownerUserId),
  );
}

const prepareExecutionEnvironment = async (
  sandbox: Sandbox,
  files: ProgramFile[],
): Promise<void> => {
  const installMarker = await sandbox.exists(
    "/workspace/.marble/install_succeeded",
  );
  if (installMarker.exists) return;

  await sandbox.mkdir("/workspace/.marble");

  const manifest = files.find(
    (file) => file.filename === "package.json" && file.filetype === "Json",
  );
  assert(manifest !== undefined, "Could not find manifest in program files.");

  await Promise.all(
    files
      .filter((file) => !file.filename.startsWith("."))
      .map((file) =>
        sandbox.writeFile(`/workspace/${file.filename}`, file.content),
      ),
  );

  const installResult = await sandbox.exec("cd /workspace && bun i");
  assert(
    installResult.success,
    `Installation failed with error: ${installResult.stderr}`,
  );

  await sandbox.writeFile(
    "/workspace/.marble/executor.ts",
    EXECUTOR_FILE_CONTENT,
  );
  await sandbox.writeFile(
    "/workspace/.marble/batch-executor.ts",
    BATCH_EXECUTOR_FILE_CONTENT,
  );
  await sandbox.writeFile("/workspace/.marble/install_succeeded", "");
};

const executeProgram = async (
  sandbox: Sandbox,
  input: JsonValue,
  environmentVariables: Record<string, string>,
) => {
  const inputAsBase64 = btoa(JSON.stringify(input));
  const command = `bun run .marble/executor.ts --inputAsBase64 ${inputAsBase64}`;
  const session = await sandbox.createSession({
    cwd: "/workspace",
    env: environmentVariables,
  });

  const result = await session.exec(command);
  await sandbox.deleteSession(session.id);

  return result;
};

const executeProgramBatch = async (
  sandbox: Sandbox,
  jobs: BatchExecutionJob[],
  environmentVariables: Record<string, string>,
) => {
  const jobsAsBase64 = btoa(
    JSON.stringify(
      jobs.map((job) => ({
        input: job.runInput,
        key: job.key,
      })),
    ),
  );
  const command = `bun run .marble/batch-executor.ts --jobsAsBase64 ${jobsAsBase64}`;
  const session = await sandbox.createSession({
    cwd: "/workspace",
    env: environmentVariables,
  });

  const result = await session.exec(command);
  await sandbox.deleteSession(session.id);

  return result;
};

function validateOutputValue(
  outputSchemaConfig: JsonValue,
  rawValue: JsonValue,
): Schemas.RunReturnValue {
  try {
    const outputSchema = Schemas.ColumnOutputSchema.parse(outputSchemaConfig);
    const validation = z.fromJSONSchema(outputSchema).safeParse(rawValue);

    if (!validation.success) {
      return createFailureState(
        "Parser",
        `Output validation failed: ${formatZodIssues(validation.error.issues)}`,
        validation.error.issues as unknown as Json,
      );
    }

    return {
      ok: true,
      value: rawValue,
    } as const;
  } catch (error) {
    return createFailureState(
      "Parser",
      `Output validation failed: ${
        error instanceof Error
          ? error.message
          : `Unexpected parse error: ${String(error)}`
      }`,
    );
  }
}

export const executeAndValidate = async (
  sandbox: Sandbox,
  programFiles: ProgramFile[],
  runInput: JsonValue,
  outputSchemaConfig: JsonValue,
  environmentVariables: Record<string, string> = {},
): Promise<Schemas.RunReturnValue> => {
  if (programFiles.length === 0) {
    return createFailureState(
      "UnsupportedRuntime",
      "No files found in program version.",
    );
  }

  await prepareExecutionEnvironment(sandbox, programFiles);

  const executionResult = await executeProgram(
    sandbox,
    runInput,
    environmentVariables,
  );
  const rawOutput = (() => {
    if (!executionResult.success) {
      const stderr = executionResult.stderr.trim() || "Program crashed";
      let detail: Json | undefined;
      let message = stderr;

      try {
        const parsedError = JSON.parse(stderr);
        if (parsedError && typeof parsedError === "object") {
          detail = parsedError as Json;
          const parsedRecord = parsedError as Record<string, unknown>;
          message =
            typeof parsedRecord.message === "string" && parsedRecord.message
              ? parsedRecord.message
              : "Program crashed with structured error";
        }
      } catch {
        // stderr was plain text, not JSON
      }

      return createFailureState("Crashed", message, detail);
    }

    try {
      const parsed = JSON.parse(executionResult.stdout.trim());
      return validateOutputValue(outputSchemaConfig, parsed as JsonValue);
    } catch (error) {
      return createFailureState(
        "Parser",
        `Output validation failed: ${
          error instanceof Error
            ? error.message
            : `Unexpected parse error: ${String(error)}`
        }`,
      );
    }
  })();

  return Schemas.RunReturnValue.parse(rawOutput);
};

export const executeAndValidateBatch = async (
  sandbox: Sandbox,
  programFiles: ProgramFile[],
  jobs: Array<
    BatchExecutionJob & {
      outputSchemaConfig: JsonValue;
    }
  >,
  environmentVariables: Record<string, string> = {},
): Promise<BatchExecutionResult[]> => {
  if (jobs.length === 0) {
    return [];
  }

  if (programFiles.length === 0) {
    return jobs.map((job) => ({
      key: job.key,
      output: createFailureState(
        "UnsupportedRuntime",
        "No files found in program version.",
      ),
    }));
  }

  await prepareExecutionEnvironment(sandbox, programFiles);

  const executionResult = await executeProgramBatch(
    sandbox,
    jobs,
    environmentVariables,
  );

  if (!executionResult.success) {
    const stderr = executionResult.stderr.trim() || "Program crashed";
    let thrownError: unknown = stderr;

    try {
      thrownError = JSON.parse(stderr);
    } catch {
      // stderr was plain text, not JSON
    }

    throw thrownError;
  }

  const parsedOutput = batchExecutorEnvelopeSchema.parse(
    JSON.parse(executionResult.stdout.trim()),
  );
  const itemByKey = new Map(
    parsedOutput.results.map((item) => [
      item.key,
      item,
    ]),
  );

  return jobs.map((job) => {
    const item = itemByKey.get(job.key);

    if (!item) {
      return {
        key: job.key,
        output: createFailureState(
          "Parser",
          `Batch output missing result for '${job.key}'`,
        ),
      };
    }

    if (!item.ok) {
      const errorDetail =
        item.error && typeof item.error === "object"
          ? (item.error as Record<string, unknown>)
          : undefined;

      return {
        key: job.key,
        output: createFailureState(
          "Crashed",
          typeof errorDetail?.message === "string" && errorDetail.message
            ? errorDetail.message
            : "Program crashed",
          item.error,
        ),
      };
    }

    return {
      key: job.key,
      output: validateOutputValue(
        job.outputSchemaConfig,
        (item.value ?? null) as JsonValue,
      ),
    };
  });
};

const STORED_RUN_SELECT = `*, program_version(*, program!program_version_program_id_fkey(*), program_file(*)), cell!target_cell_id(*, row!cell_row_id_fkey(*, table!row_table_id_fkey(*, project!table_project_id_fkey(*, profile!project_owner_profile_id_fkey(*)))), column!cell_column_id_fkey(*))`;

export const runtimeInputFromValue = (input: JsonValue): JsonValue => {
  const parsedRunInput = Schemas.RunInput.safeParse(input);
  if (parsedRunInput.success) {
    return parsedRunInput.data as JsonValue;
  }

  return createRuntimeEnvelope(input);
};

export const loadStoredRun = async (
  supabase: SupabaseClient,
  runId: string,
) => {
  const { data, error } = await supabase
    .from("program_run")
    .select(STORED_RUN_SELECT)
    .eq("id", runId);

  const run = data?.at(0);
  if (!run || error) {
    throw new Error(error?.message ?? "No run found.");
  }

  return run;
};

export type StoredRun = Awaited<ReturnType<typeof loadStoredRun>>;

export const loadStoredRuns = async (
  supabase: SupabaseClient,
  runIds: string[],
) => {
  const uniqueRunIds = Array.from(new Set(runIds));
  if (uniqueRunIds.length === 0) {
    return [] as StoredRun[];
  }

  const { data, error } = await supabase
    .from("program_run")
    .select(STORED_RUN_SELECT)
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

export const persistStoredRunFailure = async (
  supabase: SupabaseClient,
  run: StoredRun,
  runId: string,
  failState: Schemas.RunReturnValue,
) => {
  await Promise.all([
    supabase
      .from("cell")
      .update({
        state: failState,
      })
      .eq("id", run.target_cell_id),
    supabase
      .from("program_run")
      .update({
        output: failState as unknown as Json,
      })
      .eq("id", runId),
  ]);
};

export const resolveStoredRunInput = async (
  supabase: SupabaseClient,
  run: StoredRun,
) => {
  const targetRow = firstRelation(run.cell.row);
  const targetTable = firstRelation(targetRow?.table);

  if (!targetRow || !targetTable) {
    throw new Error("Could not resolve the run row or table.");
  }

  const { data: dependencies, error: dependenciesError } = await supabase
    .from("column_dependency")
    .select("source_column_id")
    .eq("target_column_id", run.cell.column.id);

  if (dependenciesError) {
    throw new Error(dependenciesError.message);
  }

  const sourceColumnIds =
    dependencies?.map((entry) => entry.source_column_id) ?? [];
  const { data: sourceColumnData, error: sourceColumnError } =
    sourceColumnIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("column")
          .select("id, table_id")
          .in("id", sourceColumnIds);

  if (sourceColumnError) {
    throw new Error(sourceColumnError.message);
  }

  const sourceColumns = sourceColumnData ?? [];

  const externalTableIds = Array.from(
    new Set(
      sourceColumns
        .map((column) => column.table_id)
        .filter((tableId) => tableId !== targetTable.id),
    ),
  );
  const { data: externalRowData, error: externalRowError } =
    externalTableIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("row")
          .select("id, table_id")
          .eq("idx", targetRow.idx)
          .in("table_id", externalTableIds);

  if (externalRowError) {
    throw new Error(externalRowError.message);
  }

  const rowsByTableId = new Map(
    (externalRowData ?? []).map((row) => [
      row.table_id,
      row.id,
    ]),
  );
  const dependencyRowIds = Array.from(
    new Set(
      sourceColumns.flatMap((column) =>
        column.table_id === targetTable.id
          ? [
              targetRow.id,
            ]
          : rowsByTableId.has(column.table_id)
            ? [
                rowsByTableId.get(column.table_id) as string,
              ]
            : [],
      ),
    ),
  );
  const { data: dependencyCellData, error: dependencyCellError } =
    sourceColumns.length === 0 || dependencyRowIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("cell")
          .select("*")
          .in("column_id", sourceColumnIds)
          .in("row_id", dependencyRowIds);

  if (dependencyCellError) {
    throw new Error(dependencyCellError.message);
  }

  const dependencyCells = dependencyCellData ?? [];

  const columns = Object.fromEntries(
    dependencyCells.map((cell) => {
      const state = cell.state as {
        ok?: boolean;
        value?: JsonValue;
      } | null;

      return [
        cell.column_id,
        {
          value: state?.ok ? (state.value ?? null) : null,
        },
      ];
    }),
  ) as Record<string, JsonValue>;

  const rowContext: Record<string, JsonValue> = {
    cell: {
      manualInputValue: run.cell.manual_input,
    },
    columns,
  };

  const inputTemplate: JsonValue = JSON.parse(run.cell.column.input_template);
  const resolvedInput = resolveColumnConfig(inputTemplate, rowContext);
  const inputPayloadSchema = Schemas.ProgramInputSchema.parse(
    run.program_version.input_schema,
  );
  const parsedInput = z.fromJSONSchema(inputPayloadSchema).parse(resolvedInput);

  return {
    parsedInput: parsedInput as Json,
    runInput: createRuntimeEnvelope(
      parsedInput as JsonValue,
      run.cell.manual_input,
    ),
  };
};

export const resolveEnvironmentVariablesForAuth = async (
  supabase: SupabaseClient,
  auth:
    | {
        profileId?: string;
        userId?: string;
      }
    | undefined,
) => {
  const ownerUserId =
    auth?.userId ??
    (auth?.profileId
      ? await resolveOwnerUserIdForProfile(supabase, auth.profileId)
      : undefined);

  return resolveEnvironmentVariablesForOwnerUserId(supabase, ownerUserId);
};

export const resolveEnvironmentVariablesForRun = async (
  supabase: SupabaseClient,
  run: StoredRun,
) => {
  const row = firstRelation(run.cell.row);
  const table = firstRelation(row?.table);
  const project = firstRelation(table?.project);
  const profile = firstRelation(project?.profile);

  if (!profile?.owner_user_id) {
    throw new Error("Could not resolve the run owner for secret loading.");
  }

  return resolveEnvironmentVariablesForOwnerUserId(
    supabase,
    profile.owner_user_id,
  );
};

export const loadProgramVersionFiles = async (
  supabase: SupabaseClient,
  programVersionId: string,
): Promise<ProgramFile[]> => {
  const { data, error } = await supabase
    .from("program_file")
    .select("*")
    .eq("version_id", programVersionId);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
};
