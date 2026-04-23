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
  loadStoredRun,
  loadStoredRuns,
  persistStoredRunFailure,
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
          type: "api-key" | "executor-token";
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

const liveRunHandler = async (c: Context<ExecutorEnv>) => {
  const { run_id } = (c.req as LiveRunValidatedRequest).valid("query");

  let run: StoredRun;
  try {
    run = await loadStoredRun(c.var.supabase, run_id);
  } catch (error) {
    throw httpError(
      404,
      error instanceof Error ? error.message : "No run found.",
      error,
    );
  }

  try {
    const [{ parsedInput, runInput }, environmentVariables] = await Promise.all(
      [
        resolveStoredRunInput(c.var.supabase, run),
        resolveEnvironmentVariablesForRun(c.var.supabase, run),
      ],
    );

    const output = await executeAndValidate(
      getSandbox(c.env.Sandbox, run.cell.column.id),
      run.program_version.program_file,
      runInput,
      run.cell.column.output_schema as JsonValue,
      environmentVariables,
    );

    await Promise.all([
      c.var.supabase
        .from("cell")
        .update({
          state: output,
        })
        .eq("id", run.target_cell_id),
      c.var.supabase
        .from("program_run")
        .update({
          input: parsedInput,
          output,
        })
        .eq("id", run_id),
    ]);

    return jsonResponse(RunEnvelopeSchema, {
      output,
      success: true,
    });
  } catch (error) {
    console.error(`[${c.get("requestId")}] Run ${run_id} failed`, error);

    const failState = failureStateFromError(error);
    await persistStoredRunFailure(c.var.supabase, run, run_id, failState);

    return jsonResponse(
      RunEnvelopeSchema,
      {
        output: failState,
        success: false,
      },
      {
        status: 500,
      },
    );
  }
};

const liveBatchRunHandler = async (c: Context<ExecutorEnv>) => {
  const { runIds } = (c.req as LiveBatchValidatedRequest).valid("json");

  let runs: StoredRun[];
  try {
    runs = await loadStoredRuns(c.var.supabase, runIds);
  } catch (error) {
    throw httpError(
      404,
      error instanceof Error ? error.message : "No runs found.",
      error,
    );
  }

  const resultsByRunId = new Map<string, z.infer<typeof BatchRunItemSchema>>();
  const runsByColumnId = new Map<string, StoredRun[]>();

  for (const run of runs) {
    const columnId = run.cell.column.id;
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
        getSandbox(c.env.Sandbox, resolvableJobs[0].run.cell.column.id),
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

  return jsonResponse(BatchRunEnvelopeSchema, {
    results: orderedResults,
    success: orderedResults.every((result) => result.success),
  });
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
        programFiles: files,
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
