import type { Sandbox } from "@cloudflare/sandbox";
import { type JsonValue, resolveColumnConfig, Schemas } from "@marble/core";
import { assert } from "@marble/lib/assert";
import type { Json, SupabaseClient, Tables } from "@marble/supabase";
import { z } from "zod";
import { EXECUTOR_FILE_CONTENT } from "./constants";

type ProgramFile = Pick<
  Tables<"program_file">,
  "content" | "filename" | "filetype"
>;

export const formatZodIssues = (issues: z.ZodIssue[]): string =>
  issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");

export const createFailureState = (
  errorType: string,
  message: string,
  detail?: Json,
): Schemas.RunReturnValue => ({
  ok: false,
  error: {
    type: errorType,
    ...(detail == null
      ? {}
      : {
          detail: detail as unknown as JsonValue,
        }),
  },
  message,
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

const createRuntimeSystem = (apolloApiKey?: string): JsonValue => ({
  providers: {
    APOLLO_IO: {
      apiKey: apolloApiKey ? String(apolloApiKey) : null,
    },
  },
});

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

export const executeAndValidate = async (
  sandbox: Sandbox,
  programFiles: ProgramFile[],
  runInput: JsonValue,
  outputSchemaConfig: JsonValue,
): Promise<Schemas.RunReturnValue> => {
  if (programFiles.length === 0) {
    return createFailureState(
      "UnsupportedRuntime",
      "No files found in program version.",
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
        // stderr was plain text, not JSON
      }

      return createFailureState("Crashed", message, detail);
    }

    try {
      const parsed = JSON.parse(executionResult.stdout.trim());
      const validation = z.fromJSONSchema(outputSchema).safeParse(parsed);

      if (!validation.success) {
        return createFailureState(
          "Parser",
          `Output validation failed: ${formatZodIssues(validation.error.issues)}`,
          validation.error.issues as unknown as Json,
        );
      }

      return {
        ok: true,
        value: parsed,
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
  })();

  return Schemas.RunReturnValue.parse(rawOutput);
};

export const runtimeInputFromValue = (
  input: JsonValue,
  apolloApiKey?: string,
): JsonValue => {
  const parsedRunInput = Schemas.RunInput.safeParse(input);
  if (parsedRunInput.success) {
    return parsedRunInput.data as JsonValue;
  }

  return {
    system: createRuntimeSystem(apolloApiKey),
    cell: {},
    input,
  };
};

export const loadStoredRun = async (
  supabase: SupabaseClient,
  runId: string,
) => {
  const { data, error } = await supabase
    .from("program_run")
    .select(
      `*, program_version(*, program!program_version_program_id_fkey(*), program_file(*)), cell!target_cell_id(*, column!column_id(*))`,
    )
    .eq("id", runId);

  const run = data?.at(0);
  if (!run || error) {
    throw new Error(error?.message ?? "No run found.");
  }

  return run;
};

export type StoredRun = Awaited<ReturnType<typeof loadStoredRun>>;

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
  apolloApiKey?: string,
) => {
  const { data: dependencies, error: dependenciesError } = await supabase
    .from("column_dependency")
    .select("source_column_id")
    .eq("target_column_id", run.cell.column.id);

  if (dependenciesError) {
    throw new Error(dependenciesError.message);
  }

  const sourceColumnIds =
    dependencies?.map((entry) => entry.source_column_id) ?? [];
  const dependencyCells =
    sourceColumnIds.length === 0
      ? []
      : ((
          await supabase
            .from("cell")
            .select("*")
            .eq("row_id", run.cell.row_id)
            .in("column_id", sourceColumnIds)
        ).data ?? []);

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
    runInput: {
      system: createRuntimeSystem(apolloApiKey),
      cell:
        run.cell.manual_input == null
          ? {}
          : {
              manualInputValue: run.cell.manual_input,
            },
      input: parsedInput as JsonValue,
    } as JsonValue,
  };
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
