import {
  ProgramInputSchema,
  ProgramOutputConfig,
  parseProgramSecretConfig,
} from "@marble/contracts";
import { os } from "../../server";
import type { RouterResourcePart } from "../../types";
import { composeResourceRouter } from "../compose";

const formatZodIssues = (
  issues: Array<{
    message: string;
    path: PropertyKey[];
  }>,
) => {
  return issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
};

const parseInputSchema = (value: unknown) => {
  const parsed = ProgramInputSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `Invalid program input schema: ${formatZodIssues(parsed.error.issues)}`,
    );
  }

  return parsed.data;
};

const parseOutputConfig = (value: unknown) => {
  const parsed = ProgramOutputConfig.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `Invalid program output config: ${formatZodIssues(parsed.error.issues)}`,
    );
  }

  return parsed.data;
};

const normalizeProgramVersionWriteInput = <
  T extends {
    inputSchema?: unknown;
    outputConfig?: unknown;
    secretConfig?: unknown;
  },
>(
  input: T,
) => {
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
};

export const programVersionRouter = {
  ...composeResourceRouter("programVersions"),
  create: os.programVersions.create.handler(({ context, input }) =>
    context.store.programVersions.create(
      normalizeProgramVersionWriteInput(input),
    ),
  ),
  update: os.programVersions.update.handler(({ context, input }) =>
    context.store.programVersions.update({
      id: input.id,
      values: normalizeProgramVersionWriteInput(input.values),
    }),
  ),
} satisfies RouterResourcePart<"programVersions">;
