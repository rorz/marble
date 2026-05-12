import type { Sandbox } from "@cloudflare/sandbox";
import {
  ColumnOutputSchema,
  type JsonValue,
  type RunReturnValue as RunReturnValueType,
} from "@marble/contracts";
import { assert } from "@marble/lib/assert";
import type { ProgramVersionTestData } from "@marble/store";
import { z } from "zod";
import {
  BATCH_EXECUTOR_FILE_CONTENT,
  EXECUTOR_FILE_CONTENT,
} from "../constants";
import { createFailureState, formatZodIssues } from "./failure-state";

export type ProgramFile = ProgramVersionTestData["files"][number];
export type BatchExecutionJob = {
  key: string;
  runInput: JsonValue;
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

export const batchExecutorEnvelopeSchema: z.ZodType<BatchExecutorEnvelope> =
  z.object({
    results: z.array(
      z.object({
        error: z.json().optional(),
        key: z.string(),
        ok: z.boolean(),
        value: z.json().optional(),
      }),
    ),
  });

export const prepareExecutionEnvironment = async (
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

export const executeProgram = async (
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

export const executeProgramBatch = async (
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

export function validateOutputValue(
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
