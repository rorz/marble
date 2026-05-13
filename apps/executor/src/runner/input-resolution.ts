import {
  ColumnRunCondition,
  type JsonValue,
  ProgramInputSchema,
  type RunReturnValue as RunReturnValueType,
  resolveColumnConfig,
} from "@marble/contracts";
import type { ProgramRunInputContext, StoredProgramRun } from "@marble/store";
import { z } from "zod";
import type { ProgramRunRuntimeStore } from "./environment";
import {
  createFailureState,
  createRuntimeEnvelope,
  formatZodIssues,
  zodIssuesToJson,
} from "./failure-state";

type CellExecutionCandidateResolution =
  | {
      cellId: string;
      status: "ready";
    }
  | {
      cellId: string;
      clearState: boolean;
      status: "waiting";
    }
  | {
      cellId: string;
      state: RunReturnValueType;
      status: "blocked";
    };

const getFailureStateSentinel = (state: unknown) => {
  if (!state || typeof state !== "object") {
    return undefined;
  }

  const error = (
    state as {
      error?: unknown;
    }
  ).error;

  if (!error || typeof error !== "object") {
    return undefined;
  }

  const detail = (
    error as {
      detail?: unknown;
    }
  ).detail;

  if (!detail || typeof detail !== "object") {
    return undefined;
  }

  const sentinel = (
    detail as {
      sentinel?: unknown;
    }
  ).sentinel;
  return typeof sentinel === "string" ? sentinel : undefined;
};

const hasUnreadyInputDependencies = (context: ProgramRunInputContext) => {
  return Object.values(context.columns).some((column) => !column.ready);
};

const resolveInputContext = (context: ProgramRunInputContext) => {
  const rowContext: Record<string, JsonValue> = {
    cell: {
      manualInputValue: context.cell.manual_input,
    },
    columns: context.columns as JsonValue,
  };
  const inputTemplate = JSON.parse(context.column.input_template) as JsonValue;
  const resolvedInput = resolveColumnConfig(inputTemplate, rowContext);
  const inputPayloadSchema = ProgramInputSchema.parse(
    context.programVersion.input_schema,
  );
  const parsedInput = z
    .fromJSONSchema(inputPayloadSchema)
    .parse(resolvedInput) as JsonValue;

  return {
    parsedInput,
    runInput: createRuntimeEnvelope(parsedInput, context.cell.manual_input),
  };
};

export const resolveProgramRunInput = async (
  store: ProgramRunRuntimeStore,
  run: StoredProgramRun,
) => {
  return resolveInputContext(
    await store.programRuns.loadInputContextForRun(run),
  );
};

const resolveCellExecutionCandidate = async (
  store: ProgramRunRuntimeStore,
  cellId: string,
): Promise<CellExecutionCandidateResolution | null> => {
  const context = await store.programRuns.loadInputContextForCellId(cellId);
  const state = context.cell.state as {
    ok?: boolean | null;
  } | null;

  if (state?.ok === null) {
    return null;
  }

  if (
    ColumnRunCondition.safeParse(context.column.run_condition).data !== true
  ) {
    return null;
  }

  if (hasUnreadyInputDependencies(context)) {
    return {
      cellId: context.cell.id,
      clearState:
        getFailureStateSentinel(context.cell.state) ===
        "AUTO_QUEUE_INPUT_VALIDATION_FAILED",
      status: "waiting",
    };
  }

  try {
    resolveInputContext(context);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        cellId: context.cell.id,
        state: createFailureState(
          "AutoQueueSkipped",
          `Not queued because resolved input failed schema validation: ${formatZodIssues(
            error.issues,
          )}`,
          {
            issues: zodIssuesToJson(error.issues),
            sentinel: "AUTO_QUEUE_INPUT_VALIDATION_FAILED",
          } as JsonValue,
        ),
        status: "blocked",
      };
    }

    throw error;
  }

  return {
    cellId: context.cell.id,
    status: "ready",
  };
};

export const listReadyDependentCellIds = async (
  store: ProgramRunRuntimeStore,
  input: {
    requestId?: string;
    successfulRuns: StoredProgramRun[];
    visitedCellIds: Set<string>;
  },
) => {
  const candidateCellIds =
    await store.programRuns.listDependentCandidateCellIds(input);
  const resolvedCandidates = await Promise.all(
    candidateCellIds.map(async (cellId) => {
      try {
        return await resolveCellExecutionCandidate(store, cellId);
      } catch (error) {
        console.error(
          `[${input.requestId ?? "unknown"}] Skipping dependent cell ${cellId}`,
          error,
        );
        return null;
      }
    }),
  );

  await Promise.all(
    resolvedCandidates.flatMap((candidate) =>
      candidate?.status === "blocked"
        ? [
            store.programRuns.setCellState({
              cellId: candidate.cellId,
              state: candidate.state,
            }),
          ]
        : candidate?.status === "waiting" && candidate.clearState
          ? [
              store.programRuns.setCellState({
                cellId: candidate.cellId,
                state: null,
              }),
            ]
          : [],
    ),
  );

  return resolvedCandidates.flatMap((candidate) =>
    candidate?.status === "ready"
      ? [
          candidate.cellId,
        ]
      : [],
  );
};
