import type { MarbleClient } from "@marble/sdk";
import type { RefObject } from "react";

import { isManualInputColumn } from "../cell";
import type { Cell, Column, Row } from "../types";

import { orderColumnsByDependency } from "./dependency-order";
import {
  listColumnCells,
  listRowCells,
  markCellSkipped,
  type RunCellHandlers,
  runCellOnce,
} from "./run-batch";

type CollectionRunnerInput = {
  addLog: (message: string) => void;
  batchInFlightRef: RefObject<boolean>;
  columnsRef: RefObject<Column[]>;
  handlers: RunCellHandlers;
  markCellAsRunning: (cellId: string) => void;
  rowsRef: RefObject<Row[]>;
  sdk: MarbleClient;
  setRunning: (running: boolean) => void;
  upsertLocalCells: (cells: Cell[]) => void;
};

export const createCollectionRunners = ({
  addLog,
  batchInFlightRef,
  columnsRef,
  handlers,
  markCellAsRunning,
  rowsRef,
  sdk,
  setRunning,
  upsertLocalCells,
}: CollectionRunnerInput) => {
  const runColumn = async (columnId: string, limit?: number) => {
    if (batchInFlightRef.current) {
      addLog("A run is already in progress.");
      return;
    }

    const col = columnsRef.current.find((column) => column.id === columnId);
    if (!col) {
      return;
    }

    if (isManualInputColumn(col)) {
      addLog(`✗ "${col.name}" is a manual input column and cannot be run.`);
      return;
    }

    batchInFlightRef.current = true;
    setRunning(true);
    try {
      const cells = await listColumnCells(sdk, columnId);
      upsertLocalCells(cells);

      const rowIdxById = new Map(
        rowsRef.current.map((row) => [
          row.id,
          row.idx,
        ]),
      );
      const ordered = cells
        .filter((cell) => rowIdxById.has(cell.rowId))
        .sort(
          (a, b) =>
            (rowIdxById.get(a.rowId) ?? 0) - (rowIdxById.get(b.rowId) ?? 0),
        );
      const targets =
        typeof limit === "number" ? ordered.slice(0, limit) : ordered;

      if (targets.length === 0) {
        addLog(`"${col.name}" has no cells to run.`);
        return;
      }

      for (const cell of targets) {
        markCellAsRunning(cell.id);
      }
      addLog(`▶ Running ${targets.length} cell(s) in "${col.name}" ...`);

      for (const cell of targets) {
        await runCellOnce(handlers, {
          cell,
          columnName: col.name,
        });
      }

      addLog(`✓ Finished running "${col.name}".`);
    } finally {
      batchInFlightRef.current = false;
      setRunning(false);
    }
  };

  const runRow = async (rowId: string) => {
    if (batchInFlightRef.current) {
      addLog("A run is already in progress.");
      return;
    }

    batchInFlightRef.current = true;
    setRunning(true);
    try {
      const cells = await listRowCells(sdk, rowId);
      upsertLocalCells(cells);

      const cellByColumn = new Map(
        cells.map((cell) => [
          cell.columnId,
          cell,
        ]),
      );
      const runnable = columnsRef.current.filter(
        (column) => !isManualInputColumn(column),
      );
      const { dependencies, hasCycle, ordered } =
        orderColumnsByDependency(runnable);

      if (hasCycle) {
        addLog(
          "⚠ Column dependency cycle detected; running remaining columns in layout order.",
        );
      }

      const failedColumnIds = new Set<string>();
      let attempted = 0;

      for (const col of ordered) {
        const cell = cellByColumn.get(col.id);
        if (!cell) {
          continue;
        }

        attempted += 1;
        const failedDependency = (dependencies.get(col.id) ?? []).find(
          (dependencyId) => failedColumnIds.has(dependencyId),
        );

        if (failedDependency) {
          markCellSkipped(handlers, {
            cell,
            columnName: col.name,
            reason: "Skipped: upstream dependency failed",
          });
          failedColumnIds.add(col.id);
          continue;
        }

        const success = await runCellOnce(handlers, {
          cell,
          columnName: col.name,
        });
        if (!success) {
          failedColumnIds.add(col.id);
        }
      }

      if (attempted === 0) {
        addLog("Row has no runnable cells.");
      }
    } finally {
      batchInFlightRef.current = false;
      setRunning(false);
    }
  };

  return {
    runColumn,
    runRow,
  };
};
