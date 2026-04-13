import { getSandbox } from "@cloudflare/sandbox";
import { type JsonValue, Schemas } from "@marble/core";
import { createClient, type SupabaseClient } from "@marble/supabase";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { type RequestIdVariables, requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { validator } from "hono/validator";
import { z } from "zod";
import {
  getApiKeyTokenFromHeaders,
  resolveApiKeyAuth,
} from "../../../packages/keys/src/index";
import { getEnv } from "./env.js";
import {
  executeAndValidate,
  failureStateFromError,
  formatZodIssues,
  loadDryRunProgramFiles,
  loadStoredRun,
  persistStoredRunFailure,
  resolveStoredRunInput,
  runtimeInputFromValue,
  type StoredRun,
} from "./runner.js";

export { Sandbox } from "@cloudflare/sandbox";

type ExecutorBindings = Env & {
  APOLLO_IO_API_KEY?: string;
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

type DryRunValidatedRequest = {
  valid(target: "json"): z.infer<typeof DryRunBodySchema>;
  valid(target: "query"): z.infer<typeof DryRunQuerySchema>;
};

const BODY_LIMIT_BYTES = 1024 * 1024;

const RunQuerySchema = z.object({
  run_id: z.string().uuid(),
});

const DryRunQuerySchema = z.object({
  programVersionId: z.string().uuid().optional(),
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

const DryRunBodySchema = z.object({
  code: z.string().min(1).optional(),
  input: z.json(),
  outputSchema: Schemas.ColumnOutputSchema,
});

const RunEnvelopeSchema = z.object({
  success: z.boolean(),
  output: Schemas.RunReturnValue,
});

const ErrorResponseSchema = z.object({
  error: z.literal(true),
  message: z.string(),
  requestId: z.string(),
  detail: z.json().optional(),
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
    const { parsedInput, runInput } = await resolveStoredRunInput(
      c.var.supabase,
      run,
      c.var.parsedEnv.APOLLO_IO_API_KEY,
    );

    const output = await executeAndValidate(
      getSandbox(c.env.Sandbox, run.cell.column.id),
      run.program_version.program_file,
      runInput,
      run.cell.column.output_schema as JsonValue,
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
      success: true,
      output,
    });
  } catch (error) {
    console.error(`[${c.get("requestId")}] Run ${run_id} failed`, error);

    const failState = failureStateFromError(error);
    await persistStoredRunFailure(c.var.supabase, run, run_id, failState);

    return jsonResponse(
      RunEnvelopeSchema,
      {
        success: false,
        output: failState,
      },
      {
        status: 500,
      },
    );
  }
};

const dryRunHandler = async (c: Context<ExecutorEnv>) => {
  const query = (c.req as DryRunValidatedRequest).valid("query");
  const body = (c.req as DryRunValidatedRequest).valid("json");

  if (!query.programVersionId && !body.code) {
    throw httpError(
      400,
      "Provide either `programVersionId` in the query string or `code` in the body.",
    );
  }

  try {
    const output = await executeAndValidate(
      getSandbox(
        c.env.Sandbox,
        query.programVersionId
          ? `${query.programVersionId}--test--${query.testKey ?? crypto.randomUUID()}`
          : `inline--${query.testKey ?? crypto.randomUUID()}`,
      ),
      await loadDryRunProgramFiles(c.var.supabase, {
        code: body.code,
        programVersionId: query.programVersionId,
      }),
      runtimeInputFromValue(body.input, c.var.parsedEnv.APOLLO_IO_API_KEY),
      body.outputSchema as JsonValue,
    );

    return jsonResponse(RunEnvelopeSchema, {
      success: true,
      output,
    });
  } catch (error) {
    console.error(`[${c.get("requestId")}] Dry run failed`, error);

    return jsonResponse(
      RunEnvelopeSchema,
      {
        success: false,
        output: failureStateFromError(error),
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
  "/test",
  authMiddleware,
  requestBodyLimit,
  zodValidator("header", JsonContentTypeSchema),
  zodValidator("query", DryRunQuerySchema),
  zodValidator("json", DryRunBodySchema),
  dryRunHandler,
);

export default app;
