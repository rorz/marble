import { getSandbox } from "@cloudflare/sandbox";
import type { JsonValue } from "@marble/contracts";
import type { StoredProgramRun } from "@marble/store";
import type { Context } from "hono";
import type { z } from "zod";
import { type ExecutorEnv, httpError } from "./middleware.js";
import {
  executeAndValidateBatch,
  failureStateFromError,
  listReadyDependentCellIds,
  resolveEnvironmentVariablesForRun,
  resolveProgramRunInput,
} from "./runner/index.js";
import type { BatchRunItemSchema } from "./schemas.js";

/**
 * Safety bounds for the synchronous dependent-run cascade. A deep or wide
 * dependency graph would otherwise recurse until it exhausts the Worker's
 * CPU / wall-clock / subrequest budget. When a bound trips we stop scheduling
 * further dependents but still return the results we already computed.
 */
const MAX_CASCADE_DEPTH = 32;
const MAX_CASCADE_CELLS = 10_000;
const MAX_CASCADE_MS = 20_000;

type CascadeBudget = {
  cellsProcessed: number;
  depth: number;
  startedAtMs: number;
};

const createCascadeBudget = (): CascadeBudget => ({
  cellsProcessed: 0,
  depth: 0,
  startedAtMs: performance.now(),
});

const cascadeBoundExceeded = (budget: CascadeBudget): string | null => {
  if (budget.depth >= MAX_CASCADE_DEPTH) {
    return `depth ${budget.depth} >= ${MAX_CASCADE_DEPTH}`;
  }

  if (budget.cellsProcessed >= MAX_CASCADE_CELLS) {
    return `cells ${budget.cellsProcessed} >= ${MAX_CASCADE_CELLS}`;
  }

  const elapsedMs = performance.now() - budget.startedAtMs;
  if (elapsedMs >= MAX_CASCADE_MS) {
    return `elapsed ${Math.round(elapsedMs)}ms >= ${MAX_CASCADE_MS}ms`;
  }

  return null;
};

const triggerDependentRuns = async (
  c: Context<ExecutorEnv>,
  successfulRuns: StoredProgramRun[],
  visitedCellIds: Set<string>,
  budget: CascadeBudget,
) => {
  if (successfulRuns.length === 0) {
    return;
  }

  const boundExceeded = cascadeBoundExceeded(budget);
  if (boundExceeded) {
    console.warn(
      `[${c.get("requestId")}] Cascade bound exceeded (${boundExceeded}); halting dependent scheduling`,
    );
    return;
  }

  try {
    const candidateCellIds = await listReadyDependentCellIds(c.var.store, {
      requestId: c.get("requestId"),
      successfulRuns,
      visitedCellIds,
    });

    if (candidateCellIds.length === 0) {
      return;
    }

    for (const cellId of candidateCellIds) {
      visitedCellIds.add(cellId);
    }

    budget.cellsProcessed += candidateCellIds.length;
    budget.depth += 1;

    const runIds =
      await c.var.store.programRuns.createPendingForCellIds(candidateCellIds);

    // harness-ignore: no-forward-reference -- mutual recursion with executeStoredRunsInternal
    await executeStoredRunsInternal(c, runIds, visitedCellIds, budget);
  } catch (error) {
    console.error(
      `[${c.get("requestId")}] Dependent run scheduling failed`,
      error,
    );
  }
};

export const executeStoredRunsInternal = async (
  c: Context<ExecutorEnv>,
  runIds: string[],
  visitedCellIds = new Set<string>(),
  budget = createCascadeBudget(),
) => {
  const runs = await c.var.store.programRuns.loadMany(runIds);
  const resultsByRunId = new Map<string, z.infer<typeof BatchRunItemSchema>>();
  const runsByColumnId = new Map<string, StoredProgramRun[]>();
  const successfulRuns: StoredProgramRun[] = [];

  for (const run of runs) {
    visitedCellIds.add(run.target_cell_id);

    const columnId = run.cell.column_id;
    const existingGroup = runsByColumnId.get(columnId);

    if (existingGroup) {
      existingGroup.push(run);
      continue;
    }

    runsByColumnId.set(columnId, [
      run,
    ]);
  }

  for (const group of runsByColumnId.values()) {
    const resolvableJobs: Array<{
      outputSchemaConfig: JsonValue;
      parsedInput: JsonValue;
      run: StoredProgramRun;
      runInput: JsonValue;
    }> = [];

    for (const run of group) {
      try {
        const { parsedInput, runInput } = await resolveProgramRunInput(
          c.var.store,
          run,
        );

        resolvableJobs.push({
          outputSchemaConfig: run.cell.column.output_schema as JsonValue,
          parsedInput,
          run,
          runInput,
        });
      } catch (error) {
        console.error(
          `[${c.get("requestId")}] Run ${run.id} failed before execution`,
          error,
        );

        const failState = failureStateFromError(error);
        await c.var.store.programRuns.persistFailure(run, failState);
        resultsByRunId.set(run.id, {
          cellId: run.target_cell_id,
          output: failState,
          runId: run.id,
          success: false,
        });
      }
    }

    if (resolvableJobs.length === 0) {
      continue;
    }

    try {
      const environmentVariables = await resolveEnvironmentVariablesForRun(
        c.var.store,
        resolvableJobs[0].run,
      );
      // Key the sandbox by column AND program version so a version bump routes
      // to a fresh container instead of reusing one with stale program files.
      // Sandbox IDs are capped at 63 chars, so the version UUID is truncated —
      // the full column UUID keeps cross-column isolation, and a 12-char slice
      // is ample to distinguish a column's handful of versions.
      const sandboxId = `${resolvableJobs[0].run.cell.column_id}--${resolvableJobs[0].run.program_version.id.slice(0, 12)}`;
      const outputs = await executeAndValidateBatch(
        getSandbox(c.env.Sandbox, sandboxId),
        resolvableJobs[0].run.program_version.program_file,
        resolvableJobs.map((job) => ({
          key: job.run.id,
          outputSchemaConfig: job.outputSchemaConfig,
          runInput: job.runInput,
        })),
        environmentVariables,
      );
      const outputByRunId = new Map(
        outputs.map((result) => [
          result.key,
          result.output,
        ]),
      );

      await Promise.all(
        resolvableJobs.map(async (job) => {
          const output = outputByRunId.get(job.run.id);

          if (!output) {
            throw new Error(`Missing batch result for run '${job.run.id}'.`);
          }

          await c.var.store.programRuns.persistSuccess({
            output,
            parsedInput: job.parsedInput,
            run: job.run,
          });

          if (output.ok) {
            successfulRuns.push(job.run);
          }

          resultsByRunId.set(job.run.id, {
            cellId: job.run.target_cell_id,
            output,
            runId: job.run.id,
            success: true,
          });
        }),
      );
    } catch (error) {
      console.error(
        `[${c.get("requestId")}] Batch execution failed for column ${resolvableJobs[0].run.cell.column.id}`,
        error,
      );

      const failState = failureStateFromError(error);
      await Promise.all(
        resolvableJobs.map((job) =>
          c.var.store.programRuns.persistFailure(job.run, failState),
        ),
      );

      for (const job of resolvableJobs) {
        resultsByRunId.set(job.run.id, {
          cellId: job.run.target_cell_id,
          output: failState,
          runId: job.run.id,
          success: false,
        });
      }
    }
  }

  const orderedResults = runIds.map((runId) => {
    const result = resultsByRunId.get(runId);

    if (!result) {
      throw httpError(500, `Batch result missing for run '${runId}'`);
    }

    return result;
  });

  await triggerDependentRuns(c, successfulRuns, visitedCellIds, budget);

  return orderedResults;
};
