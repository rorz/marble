import type { Sandbox } from "@cloudflare/sandbox";
import {
  ColumnOutputSchema,
  ColumnRunCondition,
  type JsonValue,
  ProgramInputSchema,
  parseProgramSecretConfig,
  RunInput,
  RunReturnValue,
  type RunReturnValue as RunReturnValueType,
  resolveColumnConfig,
} from "@marble/contracts";
import { assert } from "@marble/lib/assert";
import type {
  MarbleStore,
  ProgramRunInputContext,
  ProgramVersionTestData,
  StoredProgramRun,
} from "@marble/store";
import { z } from "zod";
import {
  BATCH_EXECUTOR_FILE_CONTENT,
  EXECUTOR_FILE_CONTENT,
} from "./constants";

type ProgramFile = ProgramVersionTestData["files"][number];
type BatchExecutionJob = {
  key: string;
  runInput: JsonValue;
};
type BatchExecutionResult = {
  key: string;
  output: RunReturnValueType;
};
type BatchExecutorItem = {
  error?: JsonValue;
  key: string;
  ok: boolean;
  value?: JsonValue;
};
type BatchExecutorEnvelope = {
  results: BatchExecutorItem[];
};
type ExecutorAuthContext =
  | {
      profileId?: string;
      userId?: string;
    }
  | undefined;
type CellExecutionCandidateResolution =
  | {
      cellId: string;
      status: "ready";
    }
  | {
      cellId: string;
      state: RunReturnValueType;
      status: "blocked";
    };
type MissingSecretConfiguration = {
  bindingSource: "column" | "implicit" | "program";
  description?: string;
  envName: string;
  label: string;
  required: boolean;
};

export const formatZodIssues = (issues: z.ZodIssue[]): string =>
  issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");

const createFailureState = (
  errorType: string,
  message: string,
  detail?: JsonValue,
): RunReturnValueType => ({
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

class MissingSecretConfigurationError extends Error {
  failState: RunReturnValueType;

  constructor(missingSecrets: MissingSecretConfiguration[]) {
    super(
      missingSecrets.length === 1
        ? `Waiting for secret configuration: ${missingSecrets[0].envName}`
        : `Waiting for secret configuration: ${missingSecrets
            .map((secret) => secret.envName)
            .join(", ")}`,
    );
    this.name = "MissingSecretConfigurationError";
    this.failState = createFailureState(
      "MissingSecretConfiguration",
      this.message,
      {
        missingSecrets,
        sentinel: "WAITING_FOR_SECRET_CONFIGURATION",
      } as unknown as JsonValue,
    );
  }
}

export const failureStateFromError = (error: unknown): RunReturnValueType => {
  if (
    error instanceof Error &&
    error.name === "MissingSecretConfigurationError" &&
    "failState" in error
  ) {
    return error.failState as RunReturnValueType;
  }

  if (error instanceof z.ZodError) {
    return createFailureState(
      "Validation",
      formatZodIssues(error.issues),
      error.issues as unknown as JsonValue,
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

function resolveInputContext(context: ProgramRunInputContext) {
  const rowContext: Record<string, JsonValue> = {
    cell: {
      manualInputValue: context.cell.manual_input,
    },
    columns: context.columns as unknown as JsonValue,
  };
  const inputTemplate = JSON.parse(context.column.input_template) as JsonValue;
  const resolvedInput = resolveColumnConfig(inputTemplate, rowContext);
  const inputPayloadSchema = ProgramInputSchema.parse(
    context.programVersion.input_schema,
  );
  const parsedInput = z
    .fromJSONSchema(inputPayloadSchema)
    .parse(resolvedInput) as JsonValue;

  return {
    parsedInput,
    runInput: createRuntimeEnvelope(parsedInput, context.cell.manual_input),
  };
}

export async function resolveProgramRunInput(
  store: MarbleStore,
  run: StoredProgramRun,
) {
  return resolveInputContext(
    await store.programRuns.loadInputContextForRun(run),
  );
}

async function resolveCellExecutionCandidate(
  store: MarbleStore,
  cellId: string,
): Promise<CellExecutionCandidateResolution | null> {
  const context = await store.programRuns.loadInputContextForCellId(cellId);
  const state = context.cell.state as {
    ok?: boolean | null;
  } | null;

  if (state?.ok === null) {
    return null;
  }

  if (
    ColumnRunCondition.safeParse(context.column.run_condition).data !== true
  ) {
    return null;
  }

  try {
    resolveInputContext(context);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        cellId: context.cell.id,
        state: createFailureState(
          "AutoQueueSkipped",
          `Not queued because resolved input failed schema validation: ${formatZodIssues(
            error.issues,
          )}`,
          {
            issues: error.issues as unknown as JsonValue,
            sentinel: "AUTO_QUEUE_INPUT_VALIDATION_FAILED",
          } as JsonValue,
        ),
        status: "blocked",
      };
    }

    throw error;
  }

  return {
    cellId: context.cell.id,
    status: "ready",
  };
}

export async function listReadyDependentCellIds(
  store: MarbleStore,
  input: {
    requestId?: string;
    successfulRuns: StoredProgramRun[];
    visitedCellIds: Set<string>;
  },
) {
  const candidateCellIds =
    await store.programRuns.listDependentCandidateCellIds(input);
  const resolvedCandidates = await Promise.all(
    candidateCellIds.map(async (cellId) => {
      try {
        return await resolveCellExecutionCandidate(store, cellId);
      } catch (error) {
        console.error(
          `[${input.requestId ?? "unknown"}] Skipping dependent cell ${cellId}`,
          error,
        );
        return null;
      }
    }),
  );

  await Promise.all(
    resolvedCandidates.flatMap((candidate) =>
      candidate?.status === "blocked"
        ? [
            store.programRuns.setCellState({
              cellId: candidate.cellId,
              state: candidate.state,
            }),
          ]
        : [],
    ),
  );

  return resolvedCandidates.flatMap((candidate) =>
    candidate?.status === "ready"
      ? [
          candidate.cellId,
        ]
      : [],
  );
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
  store: MarbleStore,
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
  store: MarbleStore,
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
  store: MarbleStore,
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
): RunReturnValueType {
  try {
    const outputSchema = ColumnOutputSchema.parse(outputSchemaConfig);
    const validation = z.fromJSONSchema(outputSchema).safeParse(rawValue);

    if (!validation.success) {
      return createFailureState(
        "Parser",
        `Output validation failed: ${formatZodIssues(validation.error.issues)}`,
        validation.error.issues as unknown as JsonValue,
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
): Promise<RunReturnValueType> => {
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
      let detail: JsonValue | undefined;
      let message = stderr;

      try {
        const parsedError = JSON.parse(stderr);
        if (parsedError && typeof parsedError === "object") {
          detail = parsedError as JsonValue;
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

  return RunReturnValue.parse(rawOutput);
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

export const runtimeInputFromValue = (input: JsonValue): JsonValue => {
  const parsedRunInput = RunInput.safeParse(input);
  if (parsedRunInput.success) {
    return parsedRunInput.data as JsonValue;
  }

  return createRuntimeEnvelope(input);
};
