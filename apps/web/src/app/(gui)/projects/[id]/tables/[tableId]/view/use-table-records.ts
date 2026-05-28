import { useCallback, useMemo, useRef, useState } from "react";
import type {
  Cell,
  Column,
  InitialTablePageData,
  InspectedCell,
  ReferenceableColumn,
  Row,
  SidebarMode,
  TableInfo,
} from "./types";

export const useTableRecords = (initialTablePageData: InitialTablePageData) => {
  const selectedTableId = initialTablePageData.table.id;
  const [table, setTable] = useState(initialTablePageData.table);
  const [columns, setColumns] = useState<Column[]>(
    initialTablePageData.columns,
  );
  const [rows, setRows] = useState<Row[]>(initialTablePageData.rows);
  const [cells, setCells] = useState<Cell[]>(initialTablePageData.cells);
  const [columnSecretBindings, setColumnSecretBindings] = useState(
    initialTablePageData.columnSecretBindings,
  );
  const [referenceColumns, setReferenceColumns] = useState<
    ReferenceableColumn[]
  >(initialTablePageData.referenceColumns);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [runLogSheetOpen, setRunLogSheetOpen] = useState(false);
  const [, setRunning] = useState(false);
  const [editingSurface, setEditingSurface] = useState<
    null | "crumb" | "title"
  >(null);
  const [nameDraft, setNameDraft] = useState(initialTablePageData.table.name);
  const [tableError, setTableError] = useState<null | string>(null);
  const [deletingTable, setDeletingTable] = useState(false);
  const [inspectedCell, setInspectedCell] = useState<InspectedCell | null>(
    null,
  );
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>({
    kind: "closed",
  });
  const tableRef = useRef(table);
  tableRef.current = table;
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const mergeTable = useCallback((patch: Partial<TableInfo>) => {
    setTable((current) => ({
      ...current,
      ...patch,
    }));
  }, []);
  const upsertLocalRow = useCallback((nextRow: Row) => {
    setRows((current) => {
      const existingIndex = current.findIndex((row) => row.id === nextRow.id);

      if (existingIndex === -1) {
        const next = [
          ...current,
          nextRow,
        ].sort((a, b) => a.idx - b.idx);
        rowsRef.current = next;
        return next;
      }

      const next = [
        ...current,
      ];
      next[existingIndex] = nextRow;
      next.sort((a, b) => a.idx - b.idx);
      rowsRef.current = next;
      return next;
    });
  }, []);
  const upsertLocalColumn = useCallback((nextColumn: Column) => {
    if (nextColumn.idx >= 10000) {
      return;
    }

    setColumns((current) => {
      const existingIndex = current.findIndex(
        (column) => column.id === nextColumn.id,
      );

      if (existingIndex === -1) {
        const next = [
          ...current,
          nextColumn,
        ].sort((a, b) => a.idx - b.idx);
        columnsRef.current = next;
        return next;
      }

      const next = [
        ...current,
      ];
      next[existingIndex] = {
        ...next[existingIndex],
        ...nextColumn,
      };
      next.sort((a, b) => a.idx - b.idx);
      columnsRef.current = next;
      return next;
    });
  }, []);
  const upsertLocalCells = useCallback((nextCells: Cell[]) => {
    if (nextCells.length === 0) {
      return;
    }

    setCells((current) => {
      const nextById = new Map(
        current.map((cell) => [
          cell.id,
          cell,
        ]),
      );

      for (const cell of nextCells) {
        nextById.set(cell.id, {
          ...nextById.get(cell.id),
          ...cell,
        });
      }

      const next = Array.from(nextById.values());
      cellsRef.current = next;
      return next;
    });
  }, []);
  const removeLocalRow = useCallback((rowId: string) => {
    setRows((current) => {
      const next = current.filter((row) => row.id !== rowId);

      if (next.length === current.length) {
        return current;
      }

      rowsRef.current = next;
      return next;
    });
    setCells((current) => {
      const next = current.filter((cell) => cell.rowId !== rowId);

      if (next.length === current.length) {
        return current;
      }

      cellsRef.current = next;
      return next;
    });
  }, []);
  const removeLocalColumn = useCallback((columnId: string) => {
    setColumns((current) => {
      const next = current.filter((column) => column.id !== columnId);

      if (next.length === current.length) {
        return current;
      }

      columnsRef.current = next;
      return next;
    });
    setCells((current) => {
      const next = current.filter((cell) => cell.columnId !== columnId);

      if (next.length === current.length) {
        return current;
      }

      cellsRef.current = next;
      return next;
    });
  }, []);
  const patchLocalCell = useCallback((cellId: string, patch: Partial<Cell>) => {
    setCells((current) => {
      let changed = false;
      const next = current.map((cell) => {
        if (cell.id !== cellId) {
          return cell;
        }

        changed = true;
        return {
          ...cell,
          ...patch,
        };
      });

      if (!changed) {
        return current;
      }

      cellsRef.current = next;
      return next;
    });
  }, []);
  const markCellAsRunning = useCallback(
    (cellId: string, manualInput?: string) => {
      patchLocalCell(cellId, {
        ...(manualInput === undefined
          ? {}
          : {
              manualInput,
            }),
        state: {
          ok: null,
        } as Cell["state"],
      });
    },
    [
      patchLocalCell,
    ],
  );
  const applyRunOutputToCell = useCallback(
    (cellId: string, output: unknown, manualInput?: string) => {
      patchLocalCell(cellId, {
        ...(manualInput === undefined
          ? {}
          : {
              manualInput,
            }),
        state: output as Cell["state"],
      });
    },
    [
      patchLocalCell,
    ],
  );
  const applyClientErrorToCell = useCallback(
    (cellId: string, message: string, manualInput?: string) => {
      patchLocalCell(cellId, {
        ...(manualInput === undefined
          ? {}
          : {
              manualInput,
            }),
        state: {
          error: {
            type: "Client",
          },
          message,
          ok: false,
        } as Cell["state"],
      });
    },
    [
      patchLocalCell,
    ],
  );
  const cellMap = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const cell of cells) {
      map.set(`${cell.rowId}:${cell.columnId}`, cell);
    }
    return map;
  }, [
    cells,
  ]);

  return {
    applyClientErrorToCell,
    applyRunOutputToCell,
    cellMap,
    cells,
    cellsRef,
    columnSecretBindings,
    columns,
    columnsRef,
    deletingTable,
    editingSurface,
    inspectedCell,
    markCellAsRunning,
    mergeTable,
    nameDraft,
    patchLocalCell,
    referenceColumns,
    removeLocalColumn,
    removeLocalRow,
    rows,
    rowsRef,
    runLog,
    runLogSheetOpen,
    selectedTableId,
    setCells,
    setColumnSecretBindings,
    setColumns,
    setDeletingTable,
    setEditingSurface,
    setInspectedCell,
    setNameDraft,
    setReferenceColumns,
    setRows,
    setRunLog,
    setRunLogSheetOpen,
    setRunning,
    setSidebarMode,
    setTableError,
    sidebarMode,
    table,
    tableError,
    tableRef,
    upsertLocalCells,
    upsertLocalColumn,
    upsertLocalRow,
  };
};
