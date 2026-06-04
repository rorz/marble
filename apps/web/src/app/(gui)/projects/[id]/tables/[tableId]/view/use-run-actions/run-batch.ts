import { getErrorMessage } from "@marble/lib/result";
import type { MarbleClient } from "@marble/sdk";

import { describeRunOutput } from "../cell";
import { executeRun } from "../mutations";
import type { Cell } from "../types";

export type RunCellHandlers = {
  addLog: (message: string) => void;
  applyClientErrorToCell: (cellId: string, message: string) => void;
  applyRunOutputToCell: (cellId: string, output: unknown) => void;
  markCellAsRunning: (cellId: string) => void;
  runSdk: MarbleClient;
};

/** Runs a single materialized cell, updating local state. Returns success. */
export const runCellOnce = async (
  handlers: RunCellHandlers,
  input: {
    cell: Cell;
    columnName: string;
    logStart?: boolean;
  },
): Promise<boolean> => {
  handlers.markCellAsRunning(input.cell.id);
  if (input.logStart) {
    handlers.addLog(`▶ Running "${input.columnName}" ...`);
  }

  try {
    const result = await executeRun(handlers.runSdk, {
      cellId: input.cell.id,
    });
    handlers.applyRunOutputToCell(input.cell.id, result.output);
    handlers.addLog(
      `${result.success ? "✓" : "✗"} "${input.columnName}" → ${describeRunOutput(
        result.output,
      )}`,
    );
    return result.success;
  } catch (error) {
    const message = getErrorMessage(error);
    handlers.applyClientErrorToCell(input.cell.id, message);
    handlers.addLog(`✗ "${input.columnName}" → ${message}`);
    return false;
  }
};

/** Marks a cell as skipped (recorded as a client error state) and logs why. */
export const markCellSkipped = (
  handlers: RunCellHandlers,
  input: {
    cell: Cell;
    columnName: string;
    reason: string;
  },
) => {
  handlers.applyClientErrorToCell(input.cell.id, input.reason);
  handlers.addLog(`⤼ Skipped "${input.columnName}" → ${input.reason}`);
};

export const listColumnCells = (sdk: MarbleClient, columnId: string) =>
  sdk.cells.list({
    columnId,
  });

export const listRowCells = (sdk: MarbleClient, rowId: string) =>
  sdk.cells.list({
    rowId,
  });
