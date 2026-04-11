import { getSandbox, type Sandbox } from "@cloudflare/sandbox";
import { type JsonValue, resolveColumnConfig, Schemas } from "@marble/core";
import { assert } from "@marble/lib/assert";
import { createClient, type Json, type Tables } from "@marble/supabase";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { EXECUTOR_FILE_CONTENT } from "./constants";
import { getEnv } from "./env.js";

export { Sandbox } from "@cloudflare/sandbox";

const nanoid = customAlphabet(
  "1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM",
);

const prepareExecutionEnvironment = async (
  sandbox: Sandbox,
  files: Tables<"program_file">[],
): Promise<void> => {
  const installMarker = await sandbox.exists(
    "/workspace/.marble/install_succeeded",
  );
  if (installMarker.exists) return;

  await sandbox.mkdir("/workspace/.marble");

  const manifest = files.find(
    (f) => f.filename === "package.json" && f.filetype === "Json",
  );
  assert(
    manifest !== undefined,
    `Could not find manifest in program files in DB`,
  );

  await Promise.all(
    files
      .filter((file) => !file.filename.startsWith(".")) // Disallow dotfiles
      .map(async (file) =>
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

const createFailureState = (
  errorType: string,
  message: string,
  detail?: Json,
): Schemas.RunReturnValue => {
  return {
    ok: false,
    error: {
      type: errorType,
      ...(detail != null
        ? {
            detail: detail as unknown as JsonValue,
          }
        : {}),
    },
    message,
  };
};

const executeAndValidate = async (
  sandbox: Sandbox,
  programFiles: Tables<"program_file">[],
  runInput: JsonValue,
  outputSchemaConfig: JsonValue,
): Promise<Schemas.RunReturnValue> => {
  if (!programFiles || programFiles.length === 0) {
    return createFailureState(
      "UnsupportedRuntime",
      `No files found in program version.`,
    );
  }

  await prepareExecutionEnvironment(sandbox, programFiles);

  const executionResult = await executeProgram(sandbox, runInput, {});

  const outputSchema = Schemas.ColumnOutputSchema.parse(outputSchemaConfig);

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
        // Not JSON
      }

      return createFailureState("Crashed", message, detail);
    }

    try {
      const parsed = JSON.parse(executionResult.stdout.trim());

      const validation = z.fromJSONSchema(outputSchema).safeParse(parsed);

      if (!validation.success) {
        const detail = validation.error.issues as unknown as Json | undefined;
        const summary = validation.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return createFailureState(
          "Parser",
          `Output validation failed: ${summary}`,
          detail,
        );
      }

      return {
        ok: true as const,
        value: parsed,
      };
    } catch (e) {
      const summary =
        e instanceof Error ? e.message : `Unexpected parse error: ${String(e)}`;
      return createFailureState(
        "Parser",
        `Output validation failed: ${summary}`,
      );
    }
  })();

  return Schemas.RunReturnValue.parse(rawOutput);
};

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const parsedEnv = getEnv(env as unknown as Record<string, unknown>);
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = parsedEnv;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        {
          error: true,
          message: "INTERNAL ERROR: Database misconfigured!",
        },
        {
          status: 500,
        },
      );
    }

    const url = new URL(request.url);
    const method = request.method;

    const isPostRequest = method === "POST";
    const isLivePath = url.pathname === "/run";
    const isTestPath = url.pathname === "/test";
    const isPathValid = isLivePath || isTestPath;
    const programVersionId = url.searchParams.get("programVersionId");
    const authorizationHeader = request.headers.get("authorization");

    if (!isPostRequest)
      return new Response(null, {
        status: 405,
      });
    if (!isPathValid)
      return new Response(null, {
        status: 404,
      });
    if (programVersionId === null)
      return new Response("Missing program version ID", {
        status: 400,
      });
    if (authorizationHeader === null)
      return new Response("Missing authorization header", {
        status: 401,
      });
    if (authorizationHeader !== "Bearer This.Is.Temporary.Buddy")
      return new Response("Incorrect credentials", {
        status: 401,
      });

    const parsedBody = z
      .object({
        input: z.json(),
        outputSchema: z.json(),
      })
      .safeParse(await request.json());

    if (!parsedBody.success)
      return new Response("Missing body data", {
        status: 400,
      });
    const body = parsedBody.data;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (isLivePath) {
      const runId = url.searchParams.get("run_id");

      if (!runId) {
        return Response.json(
          {
            error: true,
            message: "Missing required `run_id` search parameter.",
          },
          {
            status: 400,
          },
        );
      }

      const { data: runs, error: runError } = await supabase
        .from("program_run")
        .select(
          `*, program_version(*, program!program_version_program_id_fkey(*), program_file(*)), cell!target_cell_id(*, column!column_id(*))`,
        )
        .eq("id", runId);

      const run = runs?.at(0);

      if (!run || runError) {
        return Response.json(
          {
            error: true,
            message: runError?.message ?? "No run found.",
          },
          {
            status: 404,
          },
        );
      }

      const persistFailure = async (
        errorType: string,
        message: string,
        detail?: Json,
      ) => {
        const failState = createFailureState(errorType, message, detail);
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
        return failState;
      };

      try {
        const { data: dependencies } = await supabase
          .from("column_dependency")
          .select("source_column_id")
          .eq("target_column_id", run.cell.column.id);

        const sourceColumnIds =
          dependencies?.map((d) => d.source_column_id) ?? [];

        const { data: dependencyCells } = await supabase
          .from("cell")
          .select("*")
          .eq("row_id", run.cell.row_id)
          .in("column_id", sourceColumnIds);

        const columns: Record<string, JsonValue> = {};
        for (const cell of dependencyCells ?? []) {
          const state = cell.state as {
            ok?: boolean;
            value?: JsonValue;
          } | null;
          columns[cell.column_id] = {
            value: state?.ok ? (state.value ?? null) : null,
          };
        }

        const rowContext: Record<string, JsonValue> = {
          cell: {
            manualInputValue: run.cell.manual_input,
          },
          columns,
        };

        const inputTemplate: JsonValue = JSON.parse(
          run.cell.column.input_template,
        );
        const resolvedInput = resolveColumnConfig(inputTemplate, rowContext);

        const inputPayloadSchema = Schemas.ProgramInputSchema.parse(
          run.program_version.input_schema,
        );
        const parsedInput = z
          .fromJSONSchema(inputPayloadSchema)
          .parse(resolvedInput);

        const sandbox = getSandbox(env.Sandbox, run.cell.column.id);
        const runInput: JsonValue = {
          system: {
            providers: {
              APOLLO_IO: {
                apiKey: parsedEnv.APOLLO_IO_API_KEY
                  ? String(parsedEnv.APOLLO_IO_API_KEY)
                  : null,
              },
            },
          },
          cell: {
            manualInputValue: run.cell.manual_input ?? null,
          },
          input: parsedInput as JsonValue,
        };

        const validatedOutput = await executeAndValidate(
          sandbox,
          run.program_version.program_file,
          runInput,
          run.cell.column.output_schema as JsonValue,
        );

        await Promise.all([
          supabase
            .from("cell")
            .update({
              state: validatedOutput,
            })
            .eq("id", run.target_cell_id),
          supabase
            .from("program_run")
            .update({
              input: parsedInput as Json,
              output: validatedOutput as Json,
            })
            .eq("id", runId),
        ]);

        return Response.json({
          success: true,
          output: validatedOutput,
        });
      } catch (e) {
        console.error(`Run ${runId} failed:`, e);

        if (e instanceof z.ZodError) {
          const summary = e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
          const failState = await persistFailure(
            "Validation",
            summary,
            e.issues as unknown as Json,
          );
          return Response.json(
            {
              success: false,
              output: failState,
            },
            {
              status: 500,
            },
          );
        }

        const message =
          e instanceof Error ? e.message : `Unexpected error: ${String(e)}`;
        const failState = await persistFailure("Unhandled", message);
        return Response.json(
          {
            success: false,
            output: failState,
          },
          {
            status: 500,
          },
        );
      }
    }

    if (isTestPath) {
      try {
        const { data: programFiles } = await supabase
          .from("program_file")
          .select("*")
          .eq("version_id", programVersionId);

        const testKeyOverride = url.searchParams.get("testKey");
        const testKey = nanoid(16);
        const sandbox = getSandbox(
          env.Sandbox,
          `${programVersionId}--test--${testKeyOverride ?? testKey}`,
        );

        const runInput: JsonValue = {
          system: {
            providers: {
              APOLLO_IO: {
                apiKey: parsedEnv.APOLLO_IO_API_KEY
                  ? String(parsedEnv.APOLLO_IO_API_KEY)
                  : null,
              },
            },
          },
          cell: {
            manualInputValue: null,
          },
          input: body.input,
        };

        const validatedOutput = await executeAndValidate(
          sandbox,
          programFiles ?? [],
          runInput,
          body.outputSchema,
        );

        return Response.json({
          success: true,
          output: validatedOutput,
        });
      } catch (e) {
        console.error(`Test run failed:`, e);

        if (e instanceof z.ZodError) {
          const summary = e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
          const failState = createFailureState(
            "Validation",
            summary,
            e.issues as unknown as Json,
          );
          return Response.json(
            {
              success: false,
              output: failState,
            },
            {
              status: 500,
            },
          );
        }

        const message =
          e instanceof Error ? e.message : `Unexpected error: ${String(e)}`;
        const failState = createFailureState("Unhandled", message);
        return Response.json(
          {
            success: false,
            output: failState,
          },
          {
            status: 500,
          },
        );
      }
    }

    return new Response("Not Found", {
      status: 404,
    });
  },
};
