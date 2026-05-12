import type { Sandbox } from "@cloudflare/sandbox";
import {
  type JsonValue,
  RunInput,
  RunReturnValue,
  type RunReturnValue as RunReturnValueType,
} from "@marble/contracts";
import { z } from "zod";
import {
  createFailureState,
  createRuntimeEnvelope,
  formatZodIssues,
} from "./failure-state";
import {
  type BatchExecutionJob,
  batchExecutorEnvelopeSchema,
  executeProgram,
  executeProgramBatch,
  type ProgramFile,
  prepareExecutionEnvironment,
  validateOutputValue,
} from "./sandbox-execution";

export {
  resolveEnvironmentVariablesForProgramVersion,
  resolveEnvironmentVariablesForRun,
} from "./environment";
export { formatZodIssues } from "./failure-state";
export {
  listReadyDependentCellIds,
  resolveProgramRunInput,
} from "./input-resolution";

type BatchExecutionResult = {
  key: string;
  output: RunReturnValueType;
};

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
