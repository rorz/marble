import { getSandbox, type Sandbox } from "@cloudflare/sandbox";
import { type JsonValue, resolveColumnConfig, Schemas } from "@marble/core";
import { createClient, type Json, type Tables } from "@marble/supabase";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { getEnv } from "./env.js";
import { assert } from "@marble/lib/assert";
import { EXECUTOR_FILE_CONTENT } from "./constants";

export { Sandbox } from "@cloudflare/sandbox";

const nanoid = customAlphabet(
  "1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM",
);

const prepareExecutionEnvironment = async (
  sandbox: Sandbox,
  files: Tables<"program_file">[],
  // environmentVariables: Record<string, string>,
) => {
  console.log(
    JSON.stringify(
      {
        sandbox,
        files,
      },
      null,
      2,
    ),
  );

  const installMarker = await sandbox.exists(
    "/workspace/.marble/install_succeeded",
  );
  if (installMarker.exists) return;

  await sandbox.mkdir("/workspace/.marble");

  const manifest = files.find(
    (f) => f.filename === "package.json" && f.filetype === "Json",
  );
  //
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

  // const dotEnvContent = Object.entries(environmentVariables)
  //   .map(([key, value]) => `${key}="${value}"`)
  //   .join("\n");
  // await sandbox.writeFile("/workspace/.env", dotEnvContent);

  const installResult = await sandbox.exec("cd /workspace && bun i");
  assert(
    installResult.success,
    `Installation failed with error: ${installResult.stderr}`,
  );

  console.log("executor file content...", EXECUTOR_FILE_CONTENT);

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

    if (!isPathValid) {
      return new Response(null, {
        status: 404,
      });
    }
    if (programVersionId === null) {
      return new Response("Missing program version ID", {
        status: 400,
      });
    }
    if (authorizationHeader === null) {
      return new Response("Missing authorization header", {
        status: 401,
      });
    }
    if (authorizationHeader !== "Bearer This.Is.Temporary.Buddy") {
      return new Response("Incorrect credentials", {
        status: 401,
      });
    }

    const parsedBody = z
      .object({
        input: z.json(),
        outputSchema: z.json(),
      })
      .safeParse(await request.json());

    if (!parsedBody.success) {
      return new Response("Missing body data", {
        status: 400,
      });
    }

    const body = parsedBody.data;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (isLivePath) {
      return new Response("Temporarily Unavailable", {
        status: 503,
      });
    }

    if (isTestPath) {
      const programFiles = await supabase
        .from("program_file")
        .select("*")
        .eq("version_id", programVersionId);

      assert(
        !!programFiles.data?.length,
        `No files found for program version ID: ${programVersionId}`,
      );

      const testKeyOverride = url.searchParams.get("testKey");
      const testKey = nanoid(16); // random by default
      const sandbox = getSandbox(
        env.Sandbox,
        `${programVersionId}--test--${testKeyOverride ?? testKey}`,
      );

      await prepareExecutionEnvironment(sandbox, programFiles.data);
      const result = await executeProgram(sandbox, body.input, {
        DUMMY_ENV_VAR: "DUMMY_VALUE",
      });

      return Response.json({
        stdout: result.stdout,
        stderr: result.stderr,
      });
    }

    // if (request.method === "DOG" && url.pathname === "/dry-run") {
    //   try {
    //     const body = await request.json<{
    //       code: string;
    //       input: JsonValue;
    //       outputSchema: JsonValue;
    //     }>();

    //     const { code, input, outputSchema } = body;

    //     const inputWithProviders = {
    //       ...(typeof input === "object" && input !== null ? input : {}),
    //       system: {
    //         // @ts-expect-error Types are flexible here
    //         ...(input?.system || {}),
    //         providers: {
    //           // @ts-expect-error Types are flexible here
    //           ...(input?.system?.providers || {}),
    //           APOLLO_IO: {
    //             apiKey: parsedEnv.APOLLO_IO_API_KEY
    //               ? String(parsedEnv.APOLLO_IO_API_KEY)
    //               : undefined,
    //           },
    //         },
    //       },
    //     };

    //     const sandbox = getSandbox(env.Sandbox, "local-run-sandbox");

    //     const statement = buildProgramStatement(code, inputWithProviders);

    //     console.log(`Running local statement:\n\n${statement}`);

    //     const executionResult = await sandbox.exec(statement);

    //     const parsedOutputSchema =
    //       Schemas.ColumnOutputSchema.parse(outputSchema);

    //     const rawOutput = (() => {
    //       if (!executionResult.success) {
    //         const stderr = executionResult.stderr.trim() || "Program crashed";
    //         let detail: Json | undefined;
    //         let message = stderr;

    //         try {
    //           const parsedError = JSON.parse(stderr);
    //           if (parsedError && typeof parsedError === "object") {
    //             detail = parsedError as Json;
    //             const parsedRecord = parsedError as Record<string, unknown>;
    //             message =
    //               typeof parsedRecord.message === "string" &&
    //               parsedRecord.message
    //                 ? parsedRecord.message
    //                 : "Program crashed with structured error";
    //           }
    //         } catch {
    //           // Not JSON, just use as plain string message
    //         }

    //         return {
    //           ok: false as const,
    //           error: {
    //             type: "Crashed",
    //             ...(detail
    //               ? {
    //                   detail,
    //                 }
    //               : {}),
    //           },
    //           message: message,
    //         };
    //       }

    //       try {
    //         const parsed = JSON.parse(executionResult.stdout.trim());
    //         const validation = z
    //           .fromJSONSchema(parsedOutputSchema)
    //           .safeParse(parsed);

    //         if (!validation.success) {
    //           const detail = validation.error.issues as unknown as
    //             | Json
    //             | undefined;
    //           const summary = validation.error.issues
    //             .map((i) => `${i.path.join(".")}: ${i.message}`)
    //             .join("; ");
    //           return {
    //             ok: false as const,
    //             error: {
    //               type: "Parser",
    //               ...(detail
    //                 ? {
    //                     detail,
    //                   }
    //                 : {}),
    //             },
    //             message: `Output validation failed: ${summary}`,
    //           };
    //         }

    //         return {
    //           ok: true as const,
    //           value: parsed,
    //         };
    //       } catch (e) {
    //         const summary =
    //           e instanceof Error
    //             ? e.message
    //             : `Unexpected parse error: ${String(e)}`;
    //         return {
    //           ok: false as const,
    //           error: {
    //             type: "Parser",
    //           },
    //           message: `Output validation failed: ${summary}`,
    //         };
    //       }
    //     })();

    //     const validatedOutput = Schemas.RunReturnValue.parse(rawOutput);

    //     return Response.json({
    //       success: true,
    //       output: validatedOutput,
    //     });
    //   } catch (e) {
    //     console.error("Local run failed:", e);
    //     return Response.json(
    //       {
    //         success: false,
    //         message: e instanceof Error ? e.message : String(e),
    //       },
    //       {
    //         status: 500,
    //       },
    //     );
    //   }
    // }

    // const runId = url.searchParams.get("run_id");

    // if (!runId) {
    //   return Response.json(
    //     {
    //       error: true,
    //       message: "Missing required `run_id` search parameter.",
    //     },
    //     {
    //       status: 400,
    //     },
    //   );
    // }

    // const { data: runs, error: runError } = await supabase
    //   .from("program_run")
    //   .select(
    //     `
    //     *,
    //     program_version(*, program!program_version_program_id_fkey(*), program_file(*)),
    //     cell!target_cell_id(*, column!column_id(*))
    //   `,
    //   )
    //   .eq("id", runId);

    // const run = runs?.at(0);

    // if (!run || runError) {
    //   return Response.json(
    //     {
    //       error: true,
    //       message: runError?.message ?? "No run found.",
    //     },
    //     {
    //       status: 404,
    //     },
    //   );
    // }

    // // From here on, any failure MUST be persisted to cell.state + program_run.output
    // const persistFailure = async (
    //   errorType: string,
    //   message: string,
    //   detail?: Json,
    // ) => {
    //   const failState = {
    //     ok: false as const,
    //     error: {
    //       type: errorType,
    //       ...(detail != null
    //         ? {
    //             detail,
    //           }
    //         : {}),
    //     },
    //     message,
    //   };
    //   await Promise.all([
    //     supabase
    //       .from("cell")
    //       .update({
    //         state: failState,
    //       })
    //       .eq("id", run.target_cell_id),
    //     supabase
    //       .from("program_run")
    //       .update({
    //         output: failState as unknown as Json,
    //       })
    //       .eq("id", runId),
    //   ]);
    //   return failState;
    // };

    // try {
    //   const { data: dependencies } = await supabase
    //     .from("column_dependency")
    //     .select("source_column_id")
    //     .eq("target_column_id", run.cell.column.id);

    //   const sourceColumnIds =
    //     dependencies?.map((d) => d.source_column_id) ?? [];

    //   const { data: dependencyCells } = await supabase
    //     .from("cell")
    //     .select("*")
    //     .eq("row_id", run.cell.row_id)
    //     .in("column_id", sourceColumnIds);

    //   const columns: Record<string, JsonValue> = {};
    //   for (const cell of dependencyCells ?? []) {
    //     const state = cell.state as {
    //       ok?: boolean;
    //       value?: JsonValue;
    //     } | null;
    //     columns[cell.column_id] = {
    //       value: state?.ok ? (state.value ?? null) : null,
    //     };
    //   }

    //   const rowContext: Record<string, JsonValue> = {
    //     cell: {
    //       manualInputValue: run.cell.manual_input,
    //     },
    //     columns,
    //   };

    //   const inputTemplate: JsonValue = JSON.parse(
    //     run.cell.column.input_template,
    //   );
    //   const resolvedInput = resolveColumnConfig(inputTemplate, rowContext);

    //   const inputPayloadSchema = Schemas.ProgramInputSchema.parse(
    //     run.program_version.input_schema,
    //   );
    //   const parsedInput = z
    //     .fromJSONSchema(inputPayloadSchema)
    //     .parse(resolvedInput);

    //   const tsFile = run.program_version.program_file.find(
    //     (f: { filetype: string }) => f.filetype === "TypeScript",
    //   );

    //   if (!tsFile) {
    //     const failState = await persistFailure(
    //       "UnsupportedRuntime",
    //       `No TypeScript file found in program version.`,
    //     );
    //     return Response.json(
    //       {
    //         success: false,
    //         output: failState,
    //       },
    //       {
    //         status: 501,
    //       },
    //     );
    //   }

    //   const sandbox = getSandbox(env.Sandbox, run.cell.column.id);

    //   const runInput = {
    //     system: {
    //       providers: {
    //         APOLLO_IO: {
    //           apiKey: env.APOLLO_IO_API_KEY
    //             ? String(env.APOLLO_IO_API_KEY)
    //             : undefined,
    //         },
    //       },
    //     },
    //     cell: {
    //       manualInputValue: run.cell.manual_input ?? undefined,
    //     },
    //     input: parsedInput,
    //   };

    //   const statement = buildProgramStatement(tsFile.content, runInput);

    //   console.log(`Running statement:\n\n${statement}`);

    //   const executionResult = await sandbox.exec(statement);

    //   // Output schema is resolved ahead of execution and stored on the column.
    //   const outputSchema = Schemas.ColumnOutputSchema.parse(
    //     run.cell.column.output_schema,
    //   );

    //   const rawOutput = (() => {
    //     if (!executionResult.success) {
    //       const stderr = executionResult.stderr.trim() || "Program crashed";
    //       let detail: Json | undefined;
    //       let message = stderr;

    //       // Attempt to parse stderr as JSON to cleanly separate message and detail if possible
    //       try {
    //         const parsedError = JSON.parse(stderr);
    //         if (parsedError && typeof parsedError === "object") {
    //           detail = parsedError as Json;
    //           // Use the actual error message from the structured payload if available
    //           const parsedRecord = parsedError as Record<string, unknown>;
    //           message =
    //             typeof parsedRecord.message === "string" && parsedRecord.message
    //               ? parsedRecord.message
    //               : "Program crashed with structured error";
    //         }
    //       } catch {
    //         // Not JSON, just use as plain string message
    //       }

    //       return {
    //         ok: false as const,
    //         error: {
    //           type: "Crashed",
    //           ...(detail
    //             ? {
    //                 detail,
    //               }
    //             : {}),
    //         },
    //         message: message,
    //       };
    //     }

    //     try {
    //       const parsed = JSON.parse(executionResult.stdout.trim());

    //       // Validate shape but preserve the full raw data —
    //       // z.fromJSONSchema strips undeclared properties at every
    //       // nesting level which destroys rich API responses.
    //       const validation = z.fromJSONSchema(outputSchema).safeParse(parsed);

    //       if (!validation.success) {
    //         const detail = validation.error.issues as unknown as
    //           | Json
    //           | undefined;
    //         const summary = validation.error.issues
    //           .map((i) => `${i.path.join(".")}: ${i.message}`)
    //           .join("; ");
    //         return {
    //           ok: false as const,
    //           error: {
    //             type: "Parser",
    //             ...(detail
    //               ? {
    //                   detail,
    //                 }
    //               : {}),
    //           },
    //           message: `Output validation failed: ${summary}`,
    //         };
    //       }

    //       return {
    //         ok: true as const,
    //         value: parsed,
    //       };
    //     } catch (e) {
    //       const summary =
    //         e instanceof Error
    //           ? e.message
    //           : `Unexpected parse error: ${String(e)}`;
    //       return {
    //         ok: false as const,
    //         error: {
    //           type: "Parser",
    //         },
    //         message: `Output validation failed: ${summary}`,
    //       };
    //     }
    //   })();

    //   const validatedOutput = Schemas.RunReturnValue.parse(rawOutput);

    //   await Promise.all([
    //     supabase
    //       .from("cell")
    //       .update({
    //         state: validatedOutput,
    //       })
    //       .eq("id", run.target_cell_id),
    //     supabase
    //       .from("program_run")
    //       .update({
    //         input: parsedInput as Json,
    //         output: validatedOutput as Json,
    //       })
    //       .eq("id", runId),
    //   ]);

    //   return Response.json({
    //     success: true,
    //     output: validatedOutput,
    //   });
    // } catch (e) {
    //   console.error(`Run ${runId} failed:`, e);

    //   if (e instanceof z.ZodError) {
    //     const summary = e.issues
    //       .map((i) => `${i.path.join(".")}: ${i.message}`)
    //       .join("; ");
    //     const failState = await persistFailure(
    //       "Validation",
    //       summary,
    //       e.issues as unknown as Json,
    //     );
    //     return Response.json(
    //       {
    //         success: false,
    //         output: failState,
    //       },
    //       {
    //         status: 500,
    //       },
    //     );
    //   }

    //   const message =
    //     e instanceof Error ? e.message : `Unexpected error: ${String(e)}`;
    //   const failState = await persistFailure("Unhandled", message);
    //   return Response.json(
    //     {
    //       success: false,
    //       output: failState,
    //     },
    //     {
    //       status: 500,
    //     },
    //   );
    // }
  },
};
