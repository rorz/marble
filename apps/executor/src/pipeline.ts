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

async function triggerDependentRuns(
  c: Context<ExecutorEnv>,
  successfulRuns: StoredProgramRun[],
  visitedCellIds: Set<string>,
) {
  if (successfulRuns.length === 0) {
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

    const runIds =
      await c.var.store.programRuns.createPendingForCellIds(candidateCellIds);

    await executeStoredRunsInternal(c, runIds, visitedCellIds);
  } catch (error) {
    console.error(
      `[${c.get("requestId")}] Dependent run scheduling failed`,
      error,
    );
  }
}

export async function executeStoredRunsInternal(
  c: Context<ExecutorEnv>,
  runIds: string[],
  visitedCellIds = new Set<string>(),
) {
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
      const outputs = await executeAndValidateBatch(
        getSandbox(c.env.Sandbox, resolvableJobs[0].run.cell.column_id),
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

  await triggerDependentRuns(c, successfulRuns, visitedCellIds);

  return orderedResults;
}
