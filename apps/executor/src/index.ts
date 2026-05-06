import { getSandbox } from "@cloudflare/sandbox";
import {
  type JsonValue,
  ProgramOutputConfig,
  RunReturnValue,
} from "@marble/contracts";
import { getApiKeyTokenFromHeaders } from "@marble/keys";
import { MarbleStore, type StoredProgramRun } from "@marble/store";
import { createClient } from "@marble/supabase";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { type RequestIdVariables, requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { validator } from "hono/validator";
import { z } from "zod";
import {
  executeAndValidate,
  executeAndValidateBatch,
  failureStateFromError,
  formatZodIssues,
  listReadyDependentCellIds,
  resolveEnvironmentVariablesForProgramVersion,
  resolveEnvironmentVariablesForRun,
  resolveProgramRunInput,
  runtimeInputFromValue,
} from "./runner.js";

export { Sandbox } from "@cloudflare/sandbox";

type ExecutorEnv = {
  Bindings: Env;
  Variables: RequestIdVariables & {
    auth:
      | {
          keyId?: string;
          profileId?: string;
          type: "api-key" | "forwarded";
          userId?: string;
        }
      | undefined;
    store: MarbleStore;
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
  output: RunReturnValue,
  success: z.boolean(),
});

const BatchRunItemSchema = z.object({
  cellId: z.string().uuid(),
  output: RunReturnValue,
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
    c.set(
      "store",
      (() => {
        const supabase = createClient(
          c.env.SUPABASE_URL,
          c.env.SUPABASE_SERVICE_ROLE_KEY,
        );

        return new MarbleStore({
          context: {
            eventSource: "RAW_API",
          },
          serviceSupabase: supabase,
          supabase,
        });
      })(),
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

  const presentedToken = getApiKeyTokenFromHeaders(c.req.raw.headers);

  if (!presentedToken) {
    await next();
    return;
  }

  const keyAuth = await c.var.store.keys.authenticateToken(presentedToken);
  if (!keyAuth) {
    throw httpError(401, "Incorrect credentials");
  }

  c.set("auth", {
    keyId: keyAuth.keyId,
    profileId: keyAuth.profileId,
    type: "api-key",
    ...(keyAuth.userId
      ? {
          userId: keyAuth.userId,
        }
      : {}),
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

async function triggerDependentRuns(
  c: Context<ExecutorEnv>,
  successfulRuns: StoredProgramRun[],
  visitedCellIds: Set<string>,
) {
  if (successfulRuns.length === 0) {
    return;
  }

  try {
    const candidateCellIds = await listReadyDependentCellIds(c.var.store, {
      requestId: c.get("requestId"),
      successfulRuns,
      visitedCellIds,
    });

    if (candidateCellIds.length === 0) {
      return;
    }

    for (const cellId of candidateCellIds) {
      visitedCellIds.add(cellId);
    }

    const runIds =
      await c.var.store.programRuns.createPendingForCellIds(candidateCellIds);

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
  const runs = await c.var.store.programRuns.loadMany(runIds);
  const resultsByRunId = new Map<string, z.infer<typeof BatchRunItemSchema>>();
  const runsByColumnId = new Map<string, StoredProgramRun[]>();
  const successfulRuns: StoredProgramRun[] = [];

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
      parsedInput: JsonValue;
      run: StoredProgramRun;
      runInput: JsonValue;
    }> = [];

    for (const run of group) {
      try {
        const { parsedInput, runInput } = await resolveProgramRunInput(
          c.var.store,
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
        await c.var.store.programRuns.persistFailure(run, failState);
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
        c.var.store,
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

          await c.var.store.programRuns.persistSuccess({
            output,
            parsedInput: job.parsedInput,
            run: job.run,
          });

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
          c.var.store.programRuns.persistFailure(job.run, failState),
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
  let versionData: Awaited<
    ReturnType<MarbleStore["programRuns"]["loadProgramVersionTestData"]>
  >;

  try {
    versionData = await c.var.store.programRuns.loadProgramVersionTestData(
      query.programVersionId,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("was not found")
    ) {
      throw httpError(404, error.message, error);
    }

    throw httpError(
      500,
      error instanceof Error ? error.message : "Program version lookup failed.",
      error,
    );
  }

  try {
    const environmentVariables =
      await resolveEnvironmentVariablesForProgramVersion(c.var.store, {
        auth: c.var.auth,
        programId: versionData.programId,
        secretConfig: versionData.secretConfig as JsonValue | null,
      });
    const output = await executeAndValidate(
      getSandbox(
        c.env.Sandbox,
        `${query.programVersionId}--test--${query.testKey ?? crypto.randomUUID().slice(0, 6)}`,
      ),
      versionData.files,
      runtimeInputFromValue(body.input),
      ProgramOutputConfig.parse(versionData.outputConfig).schema as JsonValue,
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
