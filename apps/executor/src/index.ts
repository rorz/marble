import { getSandbox } from "@cloudflare/sandbox";
import { type JsonValue, Schemas } from "@marble/core";
import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { createClient, type Json, type SupabaseClient } from "@marble/supabase";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { type RequestIdVariables, requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { validator } from "hono/validator";
import { z } from "zod";
import { getEnv } from "./env.js";
import {
  executeAndValidate,
  executeAndValidateBatch,
  failureStateFromError,
  formatZodIssues,
  loadProgramVersionFiles,
  loadStoredRuns,
  persistStoredRunFailure,
  resolveCellExecutionCandidate,
  resolveEnvironmentVariablesForProgramVersion,
  resolveEnvironmentVariablesForRun,
  resolveStoredRunInput,
  runtimeInputFromValue,
  type StoredRun,
} from "./runner.js";

export { Sandbox } from "@cloudflare/sandbox";

type ExecutorBindings = Env & {
  EXECUTOR_BEARER_TOKEN?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
};

type ExecutorEnv = {
  Bindings: ExecutorBindings;
  Variables: RequestIdVariables & {
    auth:
      | {
          keyId?: string;
          profileId?: string;
          type: "api-key" | "executor-token" | "forwarded";
          userId?: string;
        }
      | undefined;
    parsedEnv: ReturnType<typeof getEnv>;
    supabase: SupabaseClient;
  };
};

type LiveRunValidatedRequest = {
  valid(target: "query"): z.infer<typeof RunQuerySchema>;
};

type TestValidatedRequest = {
  valid(target: "json"): z.infer<typeof TestBodySchema>;
  valid(target: "query"): z.infer<typeof TestQuerySchema>;
};

type LiveBatchValidatedRequest = {
  valid(target: "json"): z.infer<typeof BatchRunBodySchema>;
};

const BODY_LIMIT_BYTES = 1024 * 1024;

const RunQuerySchema = z.object({
  run_id: z.string().uuid(),
});

const TestQuerySchema = z.object({
  programVersionId: z.string().uuid(),
  testKey: z.string().min(1).optional(),
});

const JsonContentTypeSchema = z.object({
  "content-type": z
    .string()
    .refine(
      (value) => value.toLowerCase().includes("application/json"),
      "Content-Type must be application/json",
    ),
});

const TestBodySchema = z.object({
  input: z.json(),
});

const BatchRunBodySchema = z.object({
  runIds: z.array(z.string().uuid()).min(1),
});

const RunEnvelopeSchema = z.object({
  output: Schemas.RunReturnValue,
  success: z.boolean(),
});

const BatchRunItemSchema = z.object({
  cellId: z.string().uuid(),
  output: Schemas.RunReturnValue,
  runId: z.string().uuid(),
  success: z.boolean(),
});

const BatchRunEnvelopeSchema = z.object({
  results: z.array(BatchRunItemSchema),
  success: z.boolean(),
});

const ErrorResponseSchema = z.object({
  detail: z.json().optional(),
  error: z.literal(true),
  message: z.string(),
  requestId: z.string(),
});

const jsonResponse = <Schema extends z.ZodTypeAny>(
  schema: Schema,
  data: z.input<Schema>,
  init?: ResponseInit,
) => Response.json(schema.parse(data), init);

const errorDetail = (value: unknown) => {
  try {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const httpError = (
  status: 400 | 401 | 404 | 500,
  message: string,
  cause?: unknown,
) =>
  new HTTPException(status, {
    message,
    ...(cause === undefined
      ? {}
      : {
          cause,
        }),
  });

const zodValidator = <
  Target extends "header" | "json" | "param" | "query",
  Schema extends z.ZodTypeAny,
>(
  target: Target,
  schema: Schema,
) =>
  validator(target, (value) => {
    const parsed = schema.safeParse(value);

    if (!parsed.success) {
      throw httpError(
        400,
        formatZodIssues(parsed.error.issues),
        parsed.error.issues,
      );
    }

    return parsed.data;
  });

const envMiddleware = createMiddleware<ExecutorEnv>(async (c, next) => {
  try {
    const parsedEnv = getEnv(c.env as unknown as Record<string, unknown>);
    c.set("parsedEnv", parsedEnv);
    c.set(
      "supabase",
      createClient(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY),
    );
  } catch (error) {
    throw httpError(500, "INTERNAL ERROR: Database misconfigured!", error);
  }

  await next();
});

const authMiddleware = createMiddleware<ExecutorEnv>(async (c, next) => {
  const forwardedKeyId = c.req.header("x-marble-auth-key-id")?.trim();
  const forwardedProfileId = c.req.header("x-marble-auth-profile-id")?.trim();
  const forwardedUserId = c.req.header("x-marble-auth-user-id")?.trim();

  if (forwardedKeyId || forwardedProfileId || forwardedUserId) {
    c.set("auth", {
      ...(forwardedKeyId
        ? {
            keyId: forwardedKeyId,
          }
        : {}),
      ...(forwardedProfileId
        ? {
            profileId: forwardedProfileId,
          }
        : {}),
      type: "forwarded",
      ...(forwardedUserId
        ? {
            userId: forwardedUserId,
          }
        : {}),
    });
    await next();
    return;
  }

  const configuredToken = c.var.parsedEnv.EXECUTOR_BEARER_TOKEN;
  const presentedToken = getApiKeyTokenFromHeaders(c.req.raw.headers);

  if (!configuredToken && !presentedToken) {
    await next();
    return;
  }

  if (!presentedToken) {
    throw httpError(401, "Missing authorization header");
  }

  if (configuredToken && presentedToken === configuredToken) {
    c.set("auth", {
      type: "executor-token",
    });
    await next();
    return;
  }

  const keyAuth = await resolveApiKeyAuth(c.var.supabase, presentedToken);
  if (!keyAuth) {
    throw httpError(401, "Incorrect credentials");
  }

  c.set("auth", {
    keyId: keyAuth.id,
    profileId: keyAuth.owner_profile_id,
    type: "api-key",
  });
  await next();
});

const requestBodyLimit = bodyLimit({
  maxSize: BODY_LIMIT_BYTES,
  onError: (c) =>
    jsonResponse(
      ErrorResponseSchema,
      {
        error: true,
        message: "Request body is too large.",
        requestId: c.get("requestId"),
      },
      {
        status: 413,
      },
    ),
});

const app = new Hono<ExecutorEnv>({
  strict: false,
});

app.use(
  "*",
  requestId({
    generator: (c) => c.req.header("cf-ray") ?? crypto.randomUUID(),
  }),
);
app.use("*", secureHeaders());
app.use("*", envMiddleware);

app.onError((error, c) => {
  const detail =
    error instanceof HTTPException
      ? error.cause instanceof z.ZodError
        ? errorDetail(error.cause.issues)
        : errorDetail(error.cause)
      : undefined;

  if (error instanceof HTTPException) {
    return jsonResponse(
      ErrorResponseSchema,
      {
        error: true,
        message: error.message || "Request failed",
        requestId: c.get("requestId"),
        ...(detail === undefined
          ? {}
          : {
              detail,
            }),
      },
      {
        status: error.getResponse().status,
      },
    );
  }

  console.error(`[${c.get("requestId")}] Executor request failed`, error);

  return jsonResponse(
    ErrorResponseSchema,
    {
      error: true,
      message: "Internal Server Error",
      requestId: c.get("requestId"),
    },
    {
      status: 500,
    },
  );
});

app.notFound((c) =>
  jsonResponse(
    ErrorResponseSchema,
    {
      error: true,
      message: "Not Found",
      requestId: c.get("requestId"),
    },
    {
      status: 404,
    },
  ),
);

async function createPendingRunsForCellIds(
  supabase: SupabaseClient,
  cellIds: string[],
) {
  const uniqueCellIds = Array.from(new Set(cellIds));

  if (uniqueCellIds.length === 0) {
    return [] as string[];
  }

  const { data: cells, error: cellError } = await supabase
    .from("cell")
    .select("id, column_id")
    .in("id", uniqueCellIds);

  if (cellError) {
    throw new Error(cellError.message);
  }

  const cellsById = new Map(
    (cells ?? []).map((cell) => [
      cell.id,
      cell,
    ]),
  );

  if (cellsById.size !== uniqueCellIds.length) {
    throw new Error("Could not resolve every dependent cell for execution.");
  }

  const columnIds = Array.from(
    new Set(
      uniqueCellIds.map((cellId) => {
        const cell = cellsById.get(cellId);

        if (!cell) {
          throw new Error(`Dependent cell '${cellId}' was not found.`);
        }

        return cell.column_id;
      }),
    ),
  );
  const { data: columns, error: columnError } = await supabase
    .from("column")
    .select("id, program_version_id")
    .in("id", columnIds);

  if (columnError) {
    throw new Error(columnError.message);
  }

  const programVersionIdByColumnId = new Map(
    (columns ?? []).map((column) => [
      column.id,
      column.program_version_id,
    ]),
  );

  const { error: pendingStateError } = await supabase
    .from("cell")
    .update({
      state: {
        ok: null,
      } as Json,
    })
    .in("id", uniqueCellIds);

  if (pendingStateError) {
    throw new Error(pendingStateError.message);
  }

  const { data: runs, error: runError } = await supabase
    .from("program_run")
    .insert(
      uniqueCellIds.map((cellId) => {
        const cell = cellsById.get(cellId);

        if (!cell) {
          throw new Error(`Dependent cell '${cellId}' was not found.`);
        }

        const programVersionId = programVersionIdByColumnId.get(cell.column_id);

        if (!programVersionId) {
          throw new Error(
            `Program version for dependent column '${cell.column_id}' was not found.`,
          );
        }

        return {
          program_version_id: programVersionId,
          target_cell_id: cellId,
        };
      }),
    )
    .select("id, target_cell_id");

  if (runError) {
    throw new Error(runError.message);
  }

  const runIdByCellId = new Map(
    (runs ?? []).map((run) => [
      run.target_cell_id,
      run.id,
    ]),
  );

  return uniqueCellIds.map((cellId) => {
    const runId = runIdByCellId.get(cellId);

    if (!runId) {
      throw new Error(`Dependent run for cell '${cellId}' was not created.`);
    }

    return runId;
  });
}

async function listReadyDependentCellIds(
  c: Context<ExecutorEnv>,
  successfulRuns: StoredRun[],
  visitedCellIds: Set<string>,
) {
  const sourceColumnIds = Array.from(
    new Set(successfulRuns.map((run) => run.cell.column.id)),
  );

  if (sourceColumnIds.length === 0) {
    return [] as string[];
  }

  const { data: dependencies, error: dependencyError } = await c.var.supabase
    .from("column_dependency")
    .select("source_column_id, target_column_id")
    .in("source_column_id", sourceColumnIds);

  if (dependencyError) {
    throw new Error(dependencyError.message);
  }

  const dependencyRows = dependencies ?? [];

  if (dependencyRows.length === 0) {
    return [] as string[];
  }

  const targetColumnIds = Array.from(
    new Set(dependencyRows.map((dependency) => dependency.target_column_id)),
  );
  const { data: targetColumns, error: targetColumnError } = await c.var.supabase
    .from("column")
    .select("id, table_id, run_condition")
    .in("id", targetColumnIds);

  if (targetColumnError) {
    throw new Error(targetColumnError.message);
  }

  const targetColumnById = new Map(
    (targetColumns ?? [])
      .filter(
        (column) =>
          Schemas.ColumnRunCondition.safeParse(column.run_condition).data ===
          true,
      )
      .map((column) => [
        column.id,
        column,
      ]),
  );

  if (targetColumnById.size === 0) {
    return [] as string[];
  }

  const targetColumnIdsBySourceColumnId = new Map<string, string[]>();

  for (const dependency of dependencyRows) {
    if (!targetColumnById.has(dependency.target_column_id)) {
      continue;
    }

    const current =
      targetColumnIdsBySourceColumnId.get(dependency.source_column_id) ?? [];

    current.push(dependency.target_column_id);
    targetColumnIdsBySourceColumnId.set(dependency.source_column_id, current);
  }

  const externalTableIds = new Set<string>();
  const externalIdxValues = new Set<number>();

  for (const run of successfulRuns) {
    const row = Array.isArray(run.cell.row) ? run.cell.row[0] : run.cell.row;

    if (!row) {
      continue;
    }

    for (const targetColumnId of targetColumnIdsBySourceColumnId.get(
      run.cell.column.id,
    ) ?? []) {
      const targetColumn = targetColumnById.get(targetColumnId);

      if (!targetColumn || targetColumn.table_id === row.table_id) {
        continue;
      }

      externalTableIds.add(targetColumn.table_id);
      externalIdxValues.add(row.idx);
    }
  }

  const { data: externalRows, error: externalRowError } =
    externalTableIds.size === 0 || externalIdxValues.size === 0
      ? {
          data: [],
          error: null,
        }
      : await c.var.supabase
          .from("row")
          .select("id, idx, table_id")
          .in("table_id", Array.from(externalTableIds))
          .in("idx", Array.from(externalIdxValues));

  if (externalRowError) {
    throw new Error(externalRowError.message);
  }

  const rowIdByTableAndIdx = new Map(
    (externalRows ?? []).map((row) => [
      `${row.table_id}:${row.idx}`,
      row.id,
    ]),
  );
  const candidatePairs = new Map<
    string,
    {
      columnId: string;
      rowId: string;
    }
  >();

  for (const run of successfulRuns) {
    const row = Array.isArray(run.cell.row) ? run.cell.row[0] : run.cell.row;

    if (!row) {
      continue;
    }

    for (const targetColumnId of targetColumnIdsBySourceColumnId.get(
      run.cell.column.id,
    ) ?? []) {
      const targetColumn = targetColumnById.get(targetColumnId);

      if (!targetColumn) {
        continue;
      }

      const targetRowId =
        targetColumn.table_id === row.table_id
          ? row.id
          : rowIdByTableAndIdx.get(`${targetColumn.table_id}:${row.idx}`);

      if (!targetRowId) {
        continue;
      }

      candidatePairs.set(`${targetRowId}:${targetColumn.id}`, {
        columnId: targetColumn.id,
        rowId: targetRowId,
      });
    }
  }

  if (candidatePairs.size === 0) {
    return [] as string[];
  }

  const candidatePairValues = Array.from(candidatePairs.values());
  const { data: candidateCells, error: candidateCellError } =
    await c.var.supabase
      .from("cell")
      .select("id, row_id, column_id")
      .in(
        "row_id",
        Array.from(new Set(candidatePairValues.map((pair) => pair.rowId))),
      )
      .in(
        "column_id",
        Array.from(new Set(candidatePairValues.map((pair) => pair.columnId))),
      );

  if (candidateCellError) {
    throw new Error(candidateCellError.message);
  }

  const candidateCellIdByPair = new Map(
    (candidateCells ?? []).map((cell) => [
      `${cell.row_id}:${cell.column_id}`,
      cell.id,
    ]),
  );
  const candidateCellIds = Array.from(
    new Set(
      candidatePairValues
        .map((pair) =>
          candidateCellIdByPair.get(`${pair.rowId}:${pair.columnId}`),
        )
        .filter((cellId): cellId is string => cellId !== undefined),
    ),
  ).filter((cellId) => !visitedCellIds.has(cellId));

  const resolvedCandidates = await Promise.all(
    candidateCellIds.map(async (cellId) => {
      try {
        return await resolveCellExecutionCandidate(c.var.supabase, cellId);
      } catch (error) {
        console.error(
          `[${c.get("requestId")}] Skipping dependent cell ${cellId}`,
          error,
        );
        return null;
      }
    }),
  );

  const blockedCandidates = resolvedCandidates.filter(
    (
      candidate,
    ): candidate is Extract<
      Awaited<ReturnType<typeof resolveCellExecutionCandidate>>,
      {
        status: "blocked";
      }
    > => candidate !== null && candidate.status === "blocked",
  );

  await Promise.all(
    blockedCandidates.map((candidate) =>
      c.var.supabase
        .from("cell")
        .update({
          state: candidate.state as Json,
        })
        .eq("id", candidate.cellId),
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

async function triggerDependentRuns(
  c: Context<ExecutorEnv>,
  successfulRuns: StoredRun[],
  visitedCellIds: Set<string>,
) {
  if (successfulRuns.length === 0) {
    return;
  }

  try {
    const candidateCellIds = await listReadyDependentCellIds(
      c,
      successfulRuns,
      visitedCellIds,
    );

    if (candidateCellIds.length === 0) {
      return;
    }

    for (const cellId of candidateCellIds) {
      visitedCellIds.add(cellId);
    }

    const runIds = await createPendingRunsForCellIds(
      c.var.supabase,
      candidateCellIds,
    );

    await executeStoredRunsInternal(c, runIds, visitedCellIds);
  } catch (error) {
    console.error(
      `[${c.get("requestId")}] Dependent run scheduling failed`,
      error,
    );
  }
}

async function executeStoredRunsInternal(
  c: Context<ExecutorEnv>,
  runIds: string[],
  visitedCellIds = new Set<string>(),
) {
  const runs = await loadStoredRuns(c.var.supabase, runIds);
  const resultsByRunId = new Map<string, z.infer<typeof BatchRunItemSchema>>();
  const runsByColumnId = new Map<string, StoredRun[]>();
  const successfulRuns: StoredRun[] = [];

  for (const run of runs) {
    visitedCellIds.add(run.target_cell_id);

    const columnId = run.cell.column_id;
    const existingGroup = runsByColumnId.get(columnId);

    if (existingGroup) {
      existingGroup.push(run);
      continue;
    }

    runsByColumnId.set(columnId, [
      run,
    ]);
  }

  for (const group of runsByColumnId.values()) {
    const resolvableJobs: Array<{
      outputSchemaConfig: JsonValue;
      parsedInput: Json;
      run: StoredRun;
      runInput: JsonValue;
    }> = [];

    for (const run of group) {
      try {
        const { parsedInput, runInput } = await resolveStoredRunInput(
          c.var.supabase,
          run,
        );

        resolvableJobs.push({
          outputSchemaConfig: run.cell.column.output_schema as JsonValue,
          parsedInput,
          run,
          runInput,
        });
      } catch (error) {
        console.error(
          `[${c.get("requestId")}] Run ${run.id} failed before execution`,
          error,
        );

        const failState = failureStateFromError(error);
        await persistStoredRunFailure(c.var.supabase, run, run.id, failState);
        resultsByRunId.set(run.id, {
          cellId: run.target_cell_id,
          output: failState,
          runId: run.id,
          success: false,
        });
      }
    }

    if (resolvableJobs.length === 0) {
      continue;
    }

    try {
      const environmentVariables = await resolveEnvironmentVariablesForRun(
        c.var.supabase,
        resolvableJobs[0].run,
      );
      const outputs = await executeAndValidateBatch(
        getSandbox(c.env.Sandbox, resolvableJobs[0].run.cell.column_id),
        resolvableJobs[0].run.program_version.program_file,
        resolvableJobs.map((job) => ({
          key: job.run.id,
          outputSchemaConfig: job.outputSchemaConfig,
          runInput: job.runInput,
        })),
        environmentVariables,
      );
      const outputByRunId = new Map(
        outputs.map((result) => [
          result.key,
          result.output,
        ]),
      );

      await Promise.all(
        resolvableJobs.map(async (job) => {
          const output = outputByRunId.get(job.run.id);

          if (!output) {
            throw new Error(`Missing batch result for run '${job.run.id}'.`);
          }

          await Promise.all([
            c.var.supabase
              .from("cell")
              .update({
                state: output,
              })
              .eq("id", job.run.target_cell_id),
            c.var.supabase
              .from("program_run")
              .update({
                input: job.parsedInput,
                output,
              })
              .eq("id", job.run.id),
          ]);

          if (output.ok) {
            successfulRuns.push(job.run);
          }

          resultsByRunId.set(job.run.id, {
            cellId: job.run.target_cell_id,
            output,
            runId: job.run.id,
            success: true,
          });
        }),
      );
    } catch (error) {
      console.error(
        `[${c.get("requestId")}] Batch execution failed for column ${resolvableJobs[0].run.cell.column.id}`,
        error,
      );

      const failState = failureStateFromError(error);
      await Promise.all(
        resolvableJobs.map((job) =>
          persistStoredRunFailure(
            c.var.supabase,
            job.run,
            job.run.id,
            failState,
          ),
        ),
      );

      for (const job of resolvableJobs) {
        resultsByRunId.set(job.run.id, {
          cellId: job.run.target_cell_id,
          output: failState,
          runId: job.run.id,
          success: false,
        });
      }
    }
  }

  const orderedResults = runIds.map((runId) => {
    const result = resultsByRunId.get(runId);

    if (!result) {
      throw httpError(500, `Batch result missing for run '${runId}'`);
    }

    return result;
  });

  await triggerDependentRuns(c, successfulRuns, visitedCellIds);

  return orderedResults;
}

const liveRunHandler = async (c: Context<ExecutorEnv>) => {
  const { run_id } = (c.req as LiveRunValidatedRequest).valid("query");

  try {
    const results = await executeStoredRunsInternal(c, [
      run_id,
    ]);
    const result = results[0];

    return jsonResponse(
      RunEnvelopeSchema,
      {
        output: result.output,
        success: result.success,
      },
      result.success
        ? undefined
        : {
            status: 500,
          },
    );
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("no run found")
    ) {
      throw httpError(404, error.message, error);
    }

    throw httpError(
      500,
      error instanceof Error ? error.message : "Run execution failed.",
      error,
    );
  }
};

const liveBatchRunHandler = async (c: Context<ExecutorEnv>) => {
  const { runIds } = (c.req as LiveBatchValidatedRequest).valid("json");

  try {
    const results = await executeStoredRunsInternal(c, runIds);

    return jsonResponse(BatchRunEnvelopeSchema, {
      results,
      success: results.every((result) => result.success),
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("no run found")
    ) {
      throw httpError(404, error.message, error);
    }

    throw httpError(
      500,
      error instanceof Error ? error.message : "Batch execution failed.",
      error,
    );
  }
};

const testHandler = async (c: Context<ExecutorEnv>) => {
  const query = (c.req as TestValidatedRequest).valid("query");
  const body = (c.req as TestValidatedRequest).valid("json");
  const [files, versionRecord] = await Promise.all([
    loadProgramVersionFiles(c.var.supabase, query.programVersionId),
    c.var.supabase
      .from("program_version")
      .select("output_config, program_id, secret_config")
      .eq("id", query.programVersionId)
      .maybeSingle(),
  ]);

  if (versionRecord.error) {
    throw httpError(500, versionRecord.error.message, versionRecord.error);
  }

  if (!versionRecord.data) {
    throw httpError(
      404,
      `Program version '${query.programVersionId}' was not found`,
    );
  }

  try {
    const environmentVariables =
      await resolveEnvironmentVariablesForProgramVersion(c.var.supabase, {
        auth: c.var.auth,
        programId: versionRecord.data.program_id,
        secretConfig: versionRecord.data.secret_config as Json | null,
      });
    const output = await executeAndValidate(
      getSandbox(
        c.env.Sandbox,
        `${query.programVersionId ?? "inline"}--test--${query.testKey ?? crypto.randomUUID().slice(0, 6)}`,
      ),
      files,
      runtimeInputFromValue(body.input),
      Schemas.ProgramOutputConfig.parse(versionRecord.data.output_config)
        .schema as JsonValue,
      environmentVariables,
    );

    return jsonResponse(RunEnvelopeSchema, {
      output,
      success: true,
    });
  } catch (error) {
    console.error(
      `[${c.get("requestId")}] Test ${query.programVersionId} failed`,
      error,
    );

    return jsonResponse(
      RunEnvelopeSchema,
      {
        output: failureStateFromError(error),
        success: false,
      },
      {
        status: 500,
      },
    );
  }
};

app.post(
  "/run",
  authMiddleware,
  requestBodyLimit,
  zodValidator("query", RunQuerySchema),
  liveRunHandler,
);

app.post(
  "/runs",
  authMiddleware,
  requestBodyLimit,
  zodValidator("header", JsonContentTypeSchema),
  zodValidator("json", BatchRunBodySchema),
  liveBatchRunHandler,
);

app.post(
  "/test",
  authMiddleware,
  requestBodyLimit,
  zodValidator("header", JsonContentTypeSchema),
  zodValidator("query", TestQuerySchema),
  zodValidator("json", TestBodySchema),
  testHandler,
);

export default app;
