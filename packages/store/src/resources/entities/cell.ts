import { getErrorMessage } from "@marble/lib/result";
import type { Json } from "@marble/supabase";
import type { ResourceDeps } from "../../db";
import type { CellRunInput, CellRunResult, Entity } from "../../types";
import { requireProfileId } from "../../types";
import { requireServiceSupabase } from "../require-deps";
import { persistFailureForCellRun } from "./program-run/persistence";

export type Cell = Entity<"cell">;

export type ListCellsInput =
  | (Pick<Cell, "columnId"> & Partial<Pick<Cell, "rowId">>)
  | (Pick<Cell, "rowId"> & Partial<Pick<Cell, "columnId">>);

type GetCellInput = Pick<Cell, "id">;

type RunCellInput = Pick<Cell, "id"> & CellRunInput;

type SetManualValueInput = Pick<Cell, "id"> & {
  value: string | null;
};

export type CellCollectionApi = {
  readonly get: (input: GetCellInput) => Promise<Cell>;
  readonly list: (input: ListCellsInput) => Promise<Cell[]>;
  readonly run: (input: RunCellInput) => Promise<CellRunResult>;
  readonly setManualValue: (input: SetManualValueInput) => Promise<Cell>;
};

const payloadString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
};

const toCellRunResult = (
  cellId: string,
  runId: string,
  payload: Record<string, unknown>,
): CellRunResult => {
  return {
    cellId,
    error: typeof payload.error === "boolean" ? payload.error : undefined,
    message: payloadString(payload, "message"),
    output: payload.output ?? null,
    runId,
    success: payload.success === true,
  };
};

const createExecutorDispatchFailureState = (
  message: string,
  detail?: Json,
): Json => ({
  error: {
    type: "ExecutorDispatch",
    ...(detail === undefined
      ? {}
      : {
          detail,
        }),
  },
  message,
  ok: false,
});

const persistExecutorDispatchFailure = async (
  supabase: ReturnType<typeof requireServiceSupabase>,
  input: {
    cellId: string;
    detail?: Json;
    message: string;
    runId: string;
  },
) => {
  const failState = createExecutorDispatchFailureState(
    input.message,
    input.detail,
  );

  await persistFailureForCellRun(supabase, {
    cellId: input.cellId,
    failState,
    runId: input.runId,
  });
};

export class CellCollection implements CellCollectionApi {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly get = ({ id }: GetCellInput) => this.deps.db.get("cell", id);

  public readonly list = (input: ListCellsInput) =>
    this.deps.db.list("cell", input);

  public readonly run = async ({ id, ...input }: RunCellInput) => {
    if (!this.deps.actions.executeProgramRun) {
      throw new Error("Cell run requires an executeProgramRun action.");
    }

    const supabase = requireServiceSupabase(this.deps, "Cell");
    const { data: cell, error: cellError } = await supabase
      .from("cell")
      .select("column_id, id, row_id")
      .eq("id", id)
      .single();

    if (cellError || !cell) {
      throw new Error(cellError?.message ?? "Cell not found.");
    }

    const { data: column, error: columnError } = await supabase
      .from("column")
      .select("program_version_id, table_id")
      .eq("id", cell.column_id)
      .single();

    if (columnError || !column) {
      throw new Error(columnError?.message ?? "Column not found.");
    }

    const { data: table, error: tableError } = await supabase
      .from("table")
      .select("project_id")
      .eq("id", column.table_id)
      .single();

    if (tableError || !table) {
      throw new Error(tableError?.message ?? "Table not found.");
    }

    const { data: project, error: projectError } = await supabase
      .from("project")
      .select("owner_profile_id")
      .eq("id", table.project_id)
      .single();

    if (projectError || !project) {
      throw new Error(projectError?.message ?? "Project not found.");
    }

    if (project.owner_profile_id !== requireProfileId(this.deps.context)) {
      throw new Error("Cell not found.");
    }

    const { error: updateError } = await supabase
      .from("cell")
      .update({
        ...(input.manualInput === undefined
          ? {}
          : {
              manual_input: input.manualInput,
            }),
        state: {
          ok: null,
        } as Json,
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { data: run, error: runError } = await supabase
      .from("program_run")
      .insert({
        program_version_id: column.program_version_id,
        target_cell_id: id,
      })
      .select("id")
      .single();

    if (runError || !run) {
      throw new Error(runError?.message ?? "Could not create program run.");
    }

    let executorResult: Awaited<
      ReturnType<NonNullable<ResourceDeps["actions"]["executeProgramRun"]>>
    >;

    try {
      executorResult = await this.deps.actions.executeProgramRun({
        runId: run.id,
      });
    } catch (error) {
      const message = getErrorMessage(error, "Executor dispatch failed.");
      await persistExecutorDispatchFailure(supabase, {
        cellId: id,
        message,
        runId: run.id,
      });
      throw new Error(message, {
        cause: error,
      });
    }

    const { payload, status } = executorResult;

    if (status >= 400 && !(status === 500 && payload.success === false)) {
      const message = payloadString(payload, "message") ?? "Cell run failed.";
      await persistExecutorDispatchFailure(supabase, {
        cellId: id,
        detail: {
          status,
        },
        message,
        runId: run.id,
      });
      throw new Error(message);
    }

    return toCellRunResult(id, run.id, payload);
  };

  public readonly setManualValue = ({ id, value }: SetManualValueInput) =>
    this.deps.db.update("cell", id, {
      manualInput: value,
    });
}
