/**
 * packages/api/src/column/actions.ts
 *
 * Columns are the first resource to adopt the nested-router layout
 * documented in AGENTS.md ("Repository Convention Discipline"). The
 * router file at `packages/api/src/router/column.ts` would have grown to
 * carry contract-side validation for both `outputSchema` and
 * `runCondition`, plus the input-template + dependency wiring that
 * already lives on the store. Pulling that logic into a co-located
 * `<resource>/actions.ts` module keeps the router shape declarative
 * and gives the validation a stable home as the resource grows.
 *
 * The import boundary is `packages/api/src/column/index.ts`, which is
 * what `packages/api/src/router/index.ts` mounts on `marbleRouter`.
 * Nothing else in the API package should import from this file
 * directly.
 */

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
