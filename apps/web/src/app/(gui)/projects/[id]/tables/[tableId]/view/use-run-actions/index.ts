import { getErrorMessage } from "@marble/lib/result";
import type { MarbleClient } from "@marble/sdk";
import type { CellValueChangedEvent } from "ag-grid-community";
import type { AgGridReact } from "ag-grid-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useRef, useState } from "react";

import { describeRunOutput } from "../cell";
import { executeRun } from "../mutations";
import type { Cell, Column, Row } from "../types";

import { createColumnMovedHandler } from "./reorder";
import { type RunCellHandlers, runCellOnce } from "./run-batch";
import { createCollectionRunners } from "./run-collections";

const RUN_TEN_LIMIT = 10;

type UseRunActionsInput = {
  applyClientErrorToCell: (
    cellId: string,
    message: string,
    manualInput?: string,
  ) => void;
  applyRunOutputToCell: (
    cellId: string,
    output: unknown,
    manualInput?: string,
  ) => void;
  cellsRef: RefObject<Cell[]>;
  columnsRef: RefObject<Column[]>;
  gridRef: RefObject<AgGridReact | null>;
  markCellAsRunning: (cellId: string, manualInput?: string) => void;
  rowsRef: RefObject<Row[]>;
  runSdk: MarbleClient;
  sdk: MarbleClient;
  selectedTableId: string;
  setColumns: Dispatch<SetStateAction<Column[]>>;
  setRows: Dispatch<SetStateAction<Row[]>>;
  setRunLog: Dispatch<SetStateAction<string[]>>;
  setRunning: Dispatch<SetStateAction<boolean>>;
  upsertLocalCells: (cells: Cell[]) => void;
};

export const useRunActions = ({
  applyClientErrorToCell,
  applyRunOutputToCell,
  cellsRef,
  columnsRef,
  gridRef,
  markCellAsRunning,
  rowsRef,
  runSdk,
  sdk,
  selectedTableId,
  setColumns,
  setRows,
  setRunLog,
  setRunning,
  upsertLocalCells,
}: UseRunActionsInput) => {
  const [rowCountInput, setRowCountInput] = useState("1");
  const hasRowCountInput = rowCountInput.trim() !== "";
  const rowCount = Math.max(1, Number.parseInt(rowCountInput, 10) || 1);
  const batchInFlightRef = useRef(false);

  const addLog = (message: string) => {
    const ts = new Date().toLocaleTimeString();
    setRunLog((current) =>
      [
        `[${ts}] ${message}`,
        ...current,
      ].slice(0, 100),
    );
  };

  const handlers: RunCellHandlers = {
    addLog,
    applyClientErrorToCell,
    applyRunOutputToCell,
    markCellAsRunning,
    runSdk,
  };

  const onColumnMoved = createColumnMovedHandler({
    columnsRef,
    gridRef,
    sdk,
    setColumns,
  });

  const getMaterializedCell = async (columnId: string, rowId: string) => {
    const existing = cellsRef.current.find(
      (cell) => cell.rowId === rowId && cell.columnId === columnId,
    );

    if (existing) {
      return existing;
    }

    const materializedCells = await sdk.cells.list({
      columnId,
      rowId,
    });
    upsertLocalCells(materializedCells);
    return materializedCells[0] ?? null;
  };

  const onCellValueChanged = async (event: CellValueChangedEvent) => {
    const rowId = event.data._rowId as string;
    const columnId = event.colDef.field;
    if (!columnId) {
      return;
    }

    const col = columnsRef.current.find((column) => column.id === columnId);
    if (!col) {
      return;
    }

    const cell = await getMaterializedCell(columnId, rowId);

    if (!cell) {
      addLog(`✗ "${col.name}" → cell is not materialized yet`);
      return;
    }

    const manualInput = String(event.newValue ?? "");

    setRunning(true);
    markCellAsRunning(cell.id, manualInput);
    addLog(`▶ Cell edit → running "${col.name}" ...`);

    try {
      const result = await executeRun(runSdk, {
        cellId: cell.id,
        cellValue: manualInput,
      });
      applyRunOutputToCell(cell.id, result.output, manualInput);
      addLog(
        `${result.success ? "✓" : "✗"} "${col.name}" → ${describeRunOutput(
          result.output,
        )}`,
      );
    } catch (error) {
      const message = getErrorMessage(error);
      applyClientErrorToCell(cell.id, message, manualInput);
      addLog(`✗ "${col.name}" → ${message}`);
    } finally {
      setRunning(false);
    }
  };

  const runCell = async (columnId: string, rowId: string) => {
    const col = columnsRef.current.find((column) => column.id === columnId);
    if (!col) {
      return;
    }

    const cell = await getMaterializedCell(columnId, rowId);

    if (!cell) {
      addLog(`✗ "${col.name}" → cell is not materialized yet`);
      return;
    }

    setRunning(true);
    try {
      await runCellOnce(handlers, {
        cell,
        columnName: col.name,
        logStart: true,
      });
    } finally {
      setRunning(false);
    }
  };

  const { runColumn, runRow } = createCollectionRunners({
    addLog,
    batchInFlightRef,
    columnsRef,
    handlers,
    markCellAsRunning,
    rowsRef,
    sdk,
    setRunning,
    upsertLocalCells,
  });

  const handleAddRows = async () => {
    if (!selectedTableId) {
      return;
    }

    const nextIdx = Math.max(-1, ...rowsRef.current.map((row) => row.idx)) + 1;

    await sdk.tables.insertRows({
      id: selectedTableId,
      idx: nextIdx,
      quantity: rowCount,
    });
    const [nextRows, cellsByColumn] = await Promise.all([
      sdk.rows.list({
        tableId: selectedTableId,
      }),
      Promise.all(
        columnsRef.current.map((column) =>
          sdk.cells.list({
            columnId: column.id,
          }),
        ),
      ),
    ]);
    const sortedRows = [
      ...nextRows,
    ].sort((a, b) => a.idx - b.idx);

    rowsRef.current = sortedRows;
    setRows(sortedRows);
    upsertLocalCells(cellsByColumn.flat());
  };

  return {
    handleAddRows,
    hasRowCountInput,
    onCellValueChanged,
    onColumnMoved,
    rowCount,
    rowCountInput,
    runCell,
    runColumn,
    runColumnTen: (columnId: string) => runColumn(columnId, RUN_TEN_LIMIT),
    runRow,
    setRowCountInput,
  };
};
