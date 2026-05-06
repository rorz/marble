import { ColumnOutputSchema, ColumnRunCondition } from "@marble/contracts";
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
  create: os.columns.create.handler(({ context, input }) =>
    context.store.columns.create(normalizeColumnWriteInput(input)),
  ),
  delete: os.columns.delete.handler(({ context, input }) =>
    context.store.columns.delete(input.id),
  ),
  get: os.columns.get.handler(({ context, input }) =>
    context.store.columns.get(input.id),
  ),
  list: os.columns.list.handler(({ context, input }) =>
    context.store.columns.list(input),
  ),
  listReferenceable: os.columns.listReferenceable.handler(({ context }) =>
    context.store.columns.listReferenceable(),
  ),
  update: os.columns.update.handler(({ context, input }) =>
    context.store.columns.update(
      input.id,
      normalizeColumnWriteInput(input.values),
    ),
  ),
} satisfies RouterResourcePart<"columns">;
