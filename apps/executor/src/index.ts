import { getSandbox } from "@cloudflare/sandbox";
import { type JsonValue, ProgramOutputConfig } from "@marble/contracts";
import { getErrorMessage } from "@marble/lib/result";
import type { MarbleStore } from "@marble/store";
import { type Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import {
  authMiddleware,
  type ExecutorEnv,
  envMiddleware,
  httpError,
  jsonResponse,
  requestBodyLimit,
  zodValidator,
} from "./middleware.js";
import { executeStoredRunsInternal } from "./pipeline.js";
import {
  executeAndValidate,
  failureStateFromError,
  resolveEnvironmentVariablesForProgramVersion,
  runtimeInputFromValue,
} from "./runner/index.js";
import {
  BatchRunBodySchema,
  BatchRunEnvelopeSchema,
  ErrorResponseSchema,
  JsonContentTypeSchema,
  type LiveBatchValidatedRequest,
  type LiveRunValidatedRequest,
  RunEnvelopeSchema,
  RunQuerySchema,
  TestBodySchema,
  TestQuerySchema,
  type TestValidatedRequest,
} from "./schemas.js";

export { Sandbox } from "@cloudflare/sandbox";

const errorDetail = (value: unknown) => {
  try {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

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
      getErrorMessage(error, "Run execution failed."),
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
      getErrorMessage(error, "Batch execution failed."),
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
      getErrorMessage(error, "Program version lookup failed."),
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
