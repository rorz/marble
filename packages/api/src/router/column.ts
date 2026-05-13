import { ColumnOutputSchema, ColumnRunCondition } from "@marble/contracts";
import { os } from "../server";
import type { RouterResourcePart } from "../types";
import { composeResourceRouter } from "./compose";

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

function parseOutputSchema(value: unknown) {
  const parsed = ColumnOutputSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `Invalid column output schema: ${formatZodIssues(parsed.error.issues)}`,
    );
  }

  return parsed.data;
}

function parseRunCondition(value: unknown) {
  const parsed = ColumnRunCondition.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `Invalid column run condition: ${formatZodIssues(parsed.error.issues)}`,
    );
  }

  return parsed.data;
}

function normalizeColumnWriteInput<
  T extends {
    outputSchema?: unknown;
    runCondition?: unknown;
  },
>(input: T) {
  return {
    ...input,
    ...(input.outputSchema === undefined
      ? {}
      : {
          outputSchema: parseOutputSchema(input.outputSchema),
        }),
    ...(input.runCondition === undefined
      ? {}
      : {
          runCondition: parseRunCondition(input.runCondition),
        }),
  };
}

export const columnRouter = {
  ...composeResourceRouter("columns"),
  create: os.columns.create.handler(({ context, input }) =>
    context.store.columns.create(normalizeColumnWriteInput(input)),
  ),
  update: os.columns.update.handler(({ context, input }) =>
    context.store.columns.update({
      id: input.id,
      values: normalizeColumnWriteInput(input.values),
    }),
  ),
} satisfies RouterResourcePart<"columns">;
