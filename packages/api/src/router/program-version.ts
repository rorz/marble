import {
  ProgramInputSchema,
  ProgramOutputConfig,
  parseProgramSecretConfig,
} from "@marble/contracts";
import { os } from "../server";
import type { RouterResourcePart } from "../types";

function formatZodIssues(
  issues: Array<{
    message: string;
    path: PropertyKey[];
  }>,
) {
  return issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

function parseInputSchema(value: unknown) {
  const parsed = ProgramInputSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `Invalid program input schema: ${formatZodIssues(parsed.error.issues)}`,
    );
  }

  return parsed.data;
}

function parseOutputConfig(value: unknown) {
  const parsed = ProgramOutputConfig.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `Invalid program output config: ${formatZodIssues(parsed.error.issues)}`,
    );
  }

  return parsed.data;
}

function normalizeProgramVersionWriteInput<
  T extends {
    inputSchema?: unknown;
    outputConfig?: unknown;
    secretConfig?: unknown;
  },
>(input: T) {
  return {
    ...input,
    ...(input.inputSchema === undefined
      ? {}
      : {
          inputSchema: parseInputSchema(input.inputSchema),
        }),
    ...(input.outputConfig === undefined
      ? {}
      : {
          outputConfig: parseOutputConfig(input.outputConfig),
        }),
    ...(input.secretConfig === undefined
      ? {}
      : {
          secretConfig: parseProgramSecretConfig(input.secretConfig),
        }),
  };
}

export const programVersionRouter = {
  create: os.programVersions.create.handler(({ context, input }) =>
    context.store.programVersions.create(
      normalizeProgramVersionWriteInput(input),
    ),
  ),
  test: os.programVersions.test.handler(({ context, input }) =>
    context.store.programVersions.test(input),
  ),
  update: os.programVersions.update.handler(({ context, input }) =>
    context.store.programVersions.update({
      id: input.id,
      values: normalizeProgramVersionWriteInput(input.values),
    }),
  ),
} satisfies RouterResourcePart<"programVersions">;
