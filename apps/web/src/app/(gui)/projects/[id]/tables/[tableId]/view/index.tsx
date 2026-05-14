"use client";
// harness-ignore: max-file-lines -- single dense state machine: TablePageView wraps the entire table grid with shared refs across grid/cell/column/run/sidebar/broadcast concerns; lifting would obscure dataflow
import { normalizeDisplayLabel } from "@marble/lib/string";
import {
  cx,
  MarbleAlert,
  MarbleButton,
  MarbleConfirmModal,
  type MarbleConfirmModalState,
  MarbleInput,
  MarblePane,
  MarblePaneEditableCrumb,
  useMarbleRouter,
} from "@marble/ui";
import { PlayIcon } from "@phosphor-icons/react/ssr";
import {
  AllCommunityModule,
  type CellContextMenuEvent,
  type CellValueChangedEvent,
  type ColDef,
  ModuleRegistry,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useMarbleSdk, useMarbleWebSessionSdk } from "@/lib/marble-sdk-client";
import { usePrivateBroadcast } from "@/lib/realtime/private-broadcast";

import {
  type ChangeTargetDescriptor,
  changeTargetKey,
  getChangeTargetProps,
  useChangeSpotlightResolver,
} from "../../../../../change-spotlight";
import {
  GRID_CELL_BACKGROUNDS,
  GRID_ROW_NUMBER_COLOR,
  gridTheme,
  TABLE_CELL_HORIZONTAL_PADDING_PX,
  TABLE_CELL_LED_CLEARANCE_PX,
  TABLE_CELL_LED_GUTTER_PX,
} from "../grid-theme";

import {
  normalizeBroadcastCell,
  normalizeBroadcastColumn,
  normalizeBroadcastRow,
  normalizeBroadcastTablePatch,
} from "./broadcast";
import {
  describeRunOutput,
  displayCellValue,
  getCellState,
  getErrorMessage,
  isManualInputColumn,
  isRunningCellState,
  isTerminalCellState,
} from "./cell";
import { CellInspectorModal } from "./cell-inspector";
import { CellWithRunButton, RowNumberCell } from "./cell-renderers";
import { AddColumnButton, ColumnHeader } from "./column-header";
import { DATE_FORMATTER, isTableMutation } from "./constants";
import { ContextMenu } from "./context-menu";
import { EditableName } from "./editable-name";
import { escapeChangeTargetSelector } from "./interpolation-editor";
import {
  createColumn,
  deleteColumn,
  deleteRow,
  executeRun,
  hydrateColumnRecord,
  updateColumn,
  updateColumnSecretBindings,
} from "./mutations";
import { RunLogSheet } from "./run-log";
import { secretBindingEntriesToMap } from "./schema-fields";
import { ColumnSidebar } from "./sidebar";
import type {
  Cell,
  Column,
  ContextMenuState,
  GridContext,
  InitialTablePageData,
  InspectedCell,
  ReferenceableColumn,
  Row,
  SecretBindingInput,
  SidebarMode,
  TableInfo,
  TableMutation,
} from "./types";

ModuleRegistry.registerModules([
  AllCommunityModule,
]);

const TablePageView = ({
  initialTablePageData,
}: {
  initialTablePageData: InitialTablePageData;
}) => {
  const router = useMarbleRouter();
  const selectedTableId = initialTablePageData.table.id;
  const [table, setTable] = useState(initialTablePageData.table);
  const [columns, setColumns] = useState<Column[]>(
    initialTablePageData.columns,
  );
  const [rows, setRows] = useState<Row[]>(initialTablePageData.rows);
  const [cells, setCells] = useState<Cell[]>(initialTablePageData.cells);
  const programs = initialTablePageData.programs;
  const secrets = initialTablePageData.secrets;
  const programSecretBindings = initialTablePageData.programSecretBindings;
  const programSecretDeclarations =
    initialTablePageData.programSecretDeclarations;
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
  const [renameError, setRenameError] = useState<null | string>(null);
  const [inspectedCell, setInspectedCell] = useState<InspectedCell | null>(
    null,
  );

  const [sidebarMode, setSidebarMode] = useState<SidebarMode>({
    kind: "closed",
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [confirmState, setConfirmState] =
    useState<MarbleConfirmModalState | null>(null);

  const gridRef = useRef<AgGridReact>(null);
  const sdk = useMarbleSdk({
    profileId: table.projectOwnerProfileId,
  });
  const runSdk = useMarbleWebSessionSdk({
    profileId: table.projectOwnerProfileId,
  });

  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const tableRef = useRef(table);
  tableRef.current = table;
  const runningCellIdsRef = useRef(new Set<string>());
  const renameRequestRef = useRef(0);
  const renameInFlightRef = useRef(false);

  const refreshReferenceColumns = useCallback(async () => {
    setReferenceColumns(await sdk.columns.listReferenceable({}));
  }, [
    sdk,
  ]);

  const mergeTable = useCallback((patch: Partial<TableInfo>) => {
    setTable((current) => ({
      ...current,
      ...patch,
    }));
  }, []);

  const upsertLocalRow = useCallback((nextRow: Row) => {
    setRows((prev) => {
      const existingIndex = prev.findIndex((row) => row.id === nextRow.id);

      if (existingIndex === -1) {
        const next = [
          ...prev,
          nextRow,
        ].sort((a, b) => a.idx - b.idx);
        rowsRef.current = next;
        return next;
      }

      const next = [
        ...prev,
      ];
      next[existingIndex] = nextRow;
      next.sort((a, b) => a.idx - b.idx);
      rowsRef.current = next;
      return next;
    });
  }, []);

  const upsertLocalColumn = useCallback((nextColumn: Column) => {
    setColumns((prev) => {
      const existingIndex = prev.findIndex(
        (column) => column.id === nextColumn.id,
      );

      if (existingIndex === -1) {
        const next = [
          ...prev,
          nextColumn,
        ].sort((a, b) => a.idx - b.idx);
        columnsRef.current = next;
        return next;
      }

      const next = [
        ...prev,
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

    setCells((prev) => {
      const nextById = new Map(
        prev.map((cell) => [
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
    setRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);

      if (next.length === prev.length) {
        return prev;
      }

      rowsRef.current = next;
      return next;
    });
    setCells((prev) => {
      const next = prev.filter((cell) => cell.rowId !== rowId);

      if (next.length === prev.length) {
        return prev;
      }

      cellsRef.current = next;
      return next;
    });
  }, []);

  const removeLocalColumn = useCallback((columnId: string) => {
    setColumns((prev) => {
      const next = prev.filter((column) => column.id !== columnId);

      if (next.length === prev.length) {
        return prev;
      }

      columnsRef.current = next;
      return next;
    });
    setCells((prev) => {
      const next = prev.filter((cell) => cell.columnId !== columnId);

      if (next.length === prev.length) {
        return prev;
      }

      cellsRef.current = next;
      return next;
    });
  }, []);

  const patchLocalCell = useCallback((cellId: string, patch: Partial<Cell>) => {
    setCells((prev) => {
      let changed = false;
      const next = prev.map((cell) => {
        if (cell.id !== cellId) return cell;
        changed = true;
        return {
          ...cell,
          ...patch,
        };
      });

      if (!changed) return prev;
      cellsRef.current = next;
      return next;
    });
  }, []);

  const markCellAsRunning = useCallback(
    (cellId: string, manualInput?: string) => {
      runningCellIdsRef.current.add(cellId);
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
      runningCellIdsRef.current.delete(cellId);
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
      runningCellIdsRef.current.delete(cellId);
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

  // ── Realtime ──────────────────────────────────────────

  const pendingCellsRef = useRef({
    deletes: new Set<string>(),
    inserts: new Map<string, Cell>(),
    updates: new Map<string, Cell>(),
  });
  const cellFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const applyRunningCellMutation = (cell: Cell) => {
    const pending = pendingCellsRef.current;
    const currentCell = cellsRef.current.find(
      (current) => current.id === cell.id,
    );

    pending.inserts.delete(cell.id);
    pending.updates.delete(cell.id);
    runningCellIdsRef.current.add(cell.id);
    upsertLocalCells([
      {
        ...cell,
        manualInput: currentCell?.manualInput ?? cell.manualInput,
        state: {
          ok: null,
        } as Cell["state"],
      },
    ]);
  };

  const queueSettledCellMutation = (cell: Cell) => {
    if (isTerminalCellState(getCellState(cell))) {
      runningCellIdsRef.current.delete(cell.id);
    }

    const existing = cellsRef.current.some((current) => current.id === cell.id);

    if (existing) {
      pendingCellsRef.current.updates.set(cell.id, cell);
    } else {
      pendingCellsRef.current.inserts.set(cell.id, cell);
    }
  };

  const flushCells = () => {
    const pending = pendingCellsRef.current;

    if (
      pending.inserts.size === 0 &&
      pending.updates.size === 0 &&
      pending.deletes.size === 0
    ) {
      return;
    }

    setCells((prev) => {
      const next = [
        ...prev,
      ];
      let changed = false;

      if (pending.deletes.size > 0) {
        const filtered = next.filter((cell) => !pending.deletes.has(cell.id));

        if (filtered.length !== next.length) {
          next.length = 0;
          next.push(...filtered);
          changed = true;
        }
      }

      if (pending.updates.size > 0) {
        for (let index = 0; index < next.length; index += 1) {
          const updated = pending.updates.get(next[index].id);

          if (updated) {
            next[index] = updated;
            changed = true;
          }
        }
      }

      if (pending.inserts.size > 0) {
        const existingIds = new Set(next.map((cell) => cell.id));

        for (const inserted of pending.inserts.values()) {
          if (!existingIds.has(inserted.id)) {
            next.push(inserted);
            changed = true;
          }
        }
      }

      pending.updates.clear();
      pending.inserts.clear();
      pending.deletes.clear();

      if (changed) {
        cellsRef.current = next;
      }

      return changed ? next : prev;
    });
  };

  const queueCellMutation = (mutation: TableMutation) => {
    const pending = pendingCellsRef.current;

    if (mutation.type === "cell:delete") {
      pending.deletes.add(mutation.id);
    }

    if (mutation.type === "cell:upsert") {
      const cell = normalizeBroadcastCell(mutation.row);
      const state = getCellState(cell);

      if (isRunningCellState(state)) {
        applyRunningCellMutation(cell);
        return;
      }

      queueSettledCellMutation(cell);
    }

    if (cellFlushTimeoutRef.current) {
      return;
    }

    cellFlushTimeoutRef.current = setTimeout(() => {
      cellFlushTimeoutRef.current = null;
      flushCells();
    }, 100);
  };

  const applyTableMutation = (mutation: TableMutation) => {
    if (mutation.type.startsWith("cell:")) {
      queueCellMutation(mutation);
      return;
    }

    startTransition(() => {
      switch (mutation.type) {
        case "column:delete":
          removeLocalColumn(mutation.id);
          break;
        case "column:upsert":
          upsertLocalColumn(normalizeBroadcastColumn(mutation.row, programs));
          break;
        case "row:delete":
          removeLocalRow(mutation.id);
          break;
        case "row:upsert":
          upsertLocalRow(normalizeBroadcastRow(mutation.row));
          break;
        case "table:delete":
          router.push(`/projects/${tableRef.current.projectId}`);
          break;
        case "table:upsert":
          mergeTable(normalizeBroadcastTablePatch(mutation.row));
          break;
      }
    });
  };

  usePrivateBroadcast({
    enabled: Boolean(selectedTableId),
    event: "table_mutation",
    label: "Table",
    onMessage: (mutation) => {
      if (isTableMutation(mutation)) {
        applyTableMutation(mutation);
      }
    },
    topic: selectedTableId ? `table:${selectedTableId}` : "table:",
  });

  useEffect(() => {
    pendingCellsRef.current.deletes.clear();
    pendingCellsRef.current.inserts.clear();
    pendingCellsRef.current.updates.clear();

    if (!selectedTableId) {
      return;
    }

    return () => {
      if (cellFlushTimeoutRef.current) {
        clearTimeout(cellFlushTimeoutRef.current);
        cellFlushTimeoutRef.current = null;
      }
    };
  }, [
    selectedTableId,
  ]);

  // ── AG Grid config ────────────────────────────────────

  const sortedColumns = useMemo(
    () =>
      [
        ...columns,
      ].sort((a, b) => a.idx - b.idx),
    [
      columns,
    ],
  );

  const colDefs = useMemo<ColDef[]>(() => {
    return [
      {
        cellRenderer: RowNumberCell,
        cellStyle: {
          "--marble-table-cell-padding-inline": `${TABLE_CELL_HORIZONTAL_PADDING_PX}px`,
          color: GRID_ROW_NUMBER_COLOR,
          fontFamily: "var(--font-geist-mono)",
          paddingLeft: `${TABLE_CELL_HORIZONTAL_PADDING_PX}px`,
          paddingRight: `${TABLE_CELL_HORIZONTAL_PADDING_PX}px`,
        },
        headerName: "#",
        pinned: "left" as const,
        sortable: false,
        suppressMovable: true,
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        width: 52,
      },
      ...sortedColumns.map((col) => {
        const editable = isManualInputColumn(col);
        return {
          cellRenderer: CellWithRunButton,
          cellStyle: (params) => {
            const hasValue = params.value && String(params.value).trim() !== "";
            const background = editable
              ? hasValue
                ? GRID_CELL_BACKGROUNDS.editableFilled
                : GRID_CELL_BACKGROUNDS.editableEmpty
              : GRID_CELL_BACKGROUNDS.readonly;
            return {
              "--marble-table-cell-background": background,
              "--marble-table-cell-content-padding-left": `${TABLE_CELL_LED_CLEARANCE_PX}px`,
              "--marble-table-cell-led-gutter-width": `${TABLE_CELL_LED_GUTTER_PX - 4}px`,
              "--marble-table-cell-padding-inline": `${TABLE_CELL_HORIZONTAL_PADDING_PX}px`,
              background: editable ? background : "transparent",
              fontFamily: "var(--font-geist-mono)",
              paddingLeft: `${TABLE_CELL_HORIZONTAL_PADDING_PX}px`,
              paddingRight: `${TABLE_CELL_HORIZONTAL_PADDING_PX}px`,
            };
          },
          editable,
          field: col.id,
          headerComponent: ColumnHeader,
          headerName: col.name,
          headerTooltip: col.programVersion?.program?.name,
          sortable: false,
        } satisfies ColDef;
      }),
      {
        cellRenderer: () => null,
        headerComponent: AddColumnButton,
        headerName: "",
        resizable: false,
        sortable: false,
        suppressMovable: true,
        width: 44,
      },
    ];
  }, [
    sortedColumns,
  ]);

  const rowData = useMemo(() => {
    return rows.map((row) => {
      const data: Record<string, unknown> = {
        _rowId: row.id,
        _rowIndex: row.idx,
      };
      for (const col of columns) {
        const cell = cellMap.get(`${row.id}:${col.id}`);
        const state = getCellState(cell);
        data[col.id] = displayCellValue(cell);
        data[`_state:${col.id}`] = state;
      }
      return data;
    });
  }, [
    rows,
    columns,
    cellMap,
  ]);

  // ── Execution ─────────────────────────────────────────

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setRunLog((prev) =>
      [
        `[${ts}] ${msg}`,
        ...prev,
      ].slice(0, 100),
    );
  }, []);

  const onCellValueChanged = useCallback(
    async (event: CellValueChangedEvent) => {
      const rowId = event.data._rowId as string;
      const columnId = event.colDef.field;
      if (!columnId) return;

      const col = columnsRef.current.find((c) => c.id === columnId);
      if (!col) return;

      let cell = cellsRef.current.find(
        (c) => c.rowId === rowId && c.columnId === columnId,
      );

      if (!cell) {
        const materializedCells = await sdk.cells.list({
          columnId,
          rowId,
        });
        upsertLocalCells(materializedCells);
        cell = materializedCells[0];
      }

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
      } catch (err) {
        applyClientErrorToCell(
          cell.id,
          err instanceof Error ? err.message : String(err),
          manualInput,
        );
        addLog(
          `✗ "${col.name}" → ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setRunning(false);
      }
    },
    [
      addLog,
      applyClientErrorToCell,
      applyRunOutputToCell,
      markCellAsRunning,
      runSdk,
      sdk,
      upsertLocalCells,
    ],
  );

  const runCell = useCallback(
    async (columnId: string, rowId: string) => {
      const col = columnsRef.current.find((c) => c.id === columnId);
      if (!col) return;

      let cell = cellsRef.current.find(
        (c) => c.rowId === rowId && c.columnId === columnId,
      );

      if (!cell) {
        const materializedCells = await sdk.cells.list({
          columnId,
          rowId,
        });
        upsertLocalCells(materializedCells);
        cell = materializedCells[0];
      }

      if (!cell) {
        addLog(`✗ "${col.name}" → cell is not materialized yet`);
        return;
      }

      setRunning(true);
      markCellAsRunning(cell.id);
      addLog(`▶ Re-running "${col.name}" ...`);

      try {
        const result = await executeRun(runSdk, {
          cellId: cell.id,
        });
        applyRunOutputToCell(cell.id, result.output);
        addLog(
          `${result.success ? "✓" : "✗"} "${col.name}" → ${describeRunOutput(
            result.output,
          )}`,
        );
      } catch (err) {
        applyClientErrorToCell(
          cell.id,
          err instanceof Error ? err.message : String(err),
        );
        addLog(
          `✗ "${col.name}" → ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setRunning(false);
      }
    },
    [
      addLog,
      applyClientErrorToCell,
      applyRunOutputToCell,
      markCellAsRunning,
      runSdk,
      sdk,
      upsertLocalCells,
    ],
  );

  // ── CRUD handlers ─────────────────────────────────────

  const [rowCountInput, setRowCountInput] = useState("1");
  const hasRowCountInput = rowCountInput.trim() !== "";
  const rowCount = Math.max(1, Number.parseInt(rowCountInput, 10) || 1);

  const handleAddRows = useCallback(async () => {
    if (!selectedTableId) return;
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
  }, [
    selectedTableId,
    rowCount,
    sdk,
    upsertLocalCells,
  ]);

  const handleDeleteColumn = useCallback(
    async (columnId: string) => {
      await deleteColumn(sdk, columnId);
      setColumnSecretBindings((current) => {
        const nextBindings = {
          ...current,
        };

        delete nextBindings[columnId];
        return nextBindings;
      });
      await refreshReferenceColumns();
    },
    [
      refreshReferenceColumns,
      sdk,
    ],
  );

  const handleDeleteRow = useCallback(
    async (rowId: string) => {
      await deleteRow(sdk, rowId);
    },
    [
      sdk,
    ],
  );

  const handleCreateColumn = useCallback(
    async (input: {
      name: string;
      programVersionId: string;
      inputTemplate: string;
      runCondition: boolean;
    }) => {
      if (!selectedTableId) return;
      const column = await createColumn(sdk, {
        tableId: selectedTableId,
        ...input,
      });
      const materializedCells = await sdk.cells.list({
        columnId: column.id,
      });

      upsertLocalColumn(hydrateColumnRecord(column, programs));
      upsertLocalCells(materializedCells);
      await refreshReferenceColumns();
    },
    [
      programs,
      refreshReferenceColumns,
      selectedTableId,
      sdk,
      upsertLocalCells,
      upsertLocalColumn,
    ],
  );

  const handleUpdateColumn = useCallback(
    async (input: {
      columnId: string;
      name?: string;
      programVersionId?: string;
      inputTemplate?: string;
      runCondition?: boolean;
      secretBindings?: SecretBindingInput[];
    }) => {
      await updateColumn(sdk, input);

      if (input.secretBindings) {
        const savedBindings = await updateColumnSecretBindings(
          sdk,
          input.columnId,
          input.secretBindings,
        );

        setColumnSecretBindings((current) => ({
          ...current,
          [input.columnId]: secretBindingEntriesToMap(savedBindings),
        }));
      }

      await refreshReferenceColumns();
    },
    [
      refreshReferenceColumns,
      sdk,
    ],
  );

  // ── Context menu + confirm handlers ───────────────────

  const requestDeleteColumn = useCallback(
    (columnId: string) => {
      const col = columnsRef.current.find((c) => c.id === columnId);
      setConfirmState({
        confirmLabel: "Delete",
        message: `Delete "${col?.name ?? "this column"}"? All cells in this column will be permanently removed.`,
        onConfirm: () => {
          handleDeleteColumn(columnId);
          setSidebarMode((prev) =>
            prev.kind === "edit" && prev.columnId === columnId
              ? {
                  kind: "closed",
                }
              : prev,
          );
        },
        title: "Delete Column",
      });
    },
    [
      handleDeleteColumn,
    ],
  );

  const requestDeleteRow = useCallback(
    (rowId: string, rowIndex: number) => {
      setConfirmState({
        confirmLabel: "Delete",
        message: `Delete Row ${rowIndex + 1}? All cells in this row will be permanently removed.`,
        onConfirm: () => handleDeleteRow(rowId),
        title: "Delete Row",
      });
    },
    [
      handleDeleteRow,
    ],
  );

  const handleHeaderClick = useCallback((columnId: string) => {
    setSidebarMode({
      columnId,
      kind: "edit",
    });
  }, []);

  const handleHeaderContextMenu = useCallback(
    (columnId: string, x: number, y: number) => {
      setContextMenu({
        items: [
          {
            label: "Edit Column",
            onClick: () =>
              setSidebarMode({
                columnId,
                kind: "edit",
              }),
          },
          {
            danger: true,
            label: "Delete Column",
            onClick: () => requestDeleteColumn(columnId),
          },
        ],
        x,
        y,
      });
    },
    [
      requestDeleteColumn,
    ],
  );

  const onCellContextMenu = useCallback(
    (event: CellContextMenuEvent) => {
      const browserEvent = event.event as MouseEvent | undefined;
      browserEvent?.preventDefault();
      if (event.colDef.headerName !== "#") return;
      const rowId = event.data?._rowId as string | undefined;
      const rowIndex = event.data?._rowIndex as number | undefined;
      if (!rowId || rowIndex === undefined || !browserEvent) return;
      setContextMenu({
        items: [
          {
            danger: true,
            label: `Delete Row ${rowIndex + 1}`,
            onClick: () => requestDeleteRow(rowId, rowIndex),
          },
        ],
        x: browserEvent.clientX,
        y: browserEvent.clientY,
      });
    },
    [
      requestDeleteRow,
    ],
  );

  // ── Grid context ──────────────────────────────────────

  const gridContext = useMemo<GridContext>(
    () => ({
      activeColumnId: sidebarMode.kind === "edit" ? sidebarMode.columnId : null,
      onHeaderClick: handleHeaderClick,
      onHeaderContextMenu: handleHeaderContextMenu,
      openCreateColumn: () =>
        setSidebarMode({
          kind: "create",
        }),
      runCell,
    }),
    [
      runCell,
      handleHeaderClick,
      handleHeaderContextMenu,
      sidebarMode,
    ],
  );

  // ── Render ────────────────────────────────────────────

  const selectedTable = table;
  const selectedTableName = selectedTable.name;

  useEffect(() => {
    if (editingSurface !== null) {
      return;
    }

    setNameDraft((current) =>
      current === selectedTableName ? current : selectedTableName,
    );
  }, [
    editingSurface,
    selectedTableName,
  ]);

  const stopEditingName = useCallback(() => {
    setEditingSurface(null);
    setNameDraft(selectedTableName);
  }, [
    selectedTableName,
  ]);

  const commitName = useCallback(async () => {
    const nextName = normalizeDisplayLabel(nameDraft, "Untitled Table");
    const previousTable = tableRef.current;

    if (nextName === previousTable.name) {
      setEditingSurface(null);
      setNameDraft(previousTable.name);
      return;
    }

    const requestId = renameRequestRef.current + 1;
    renameRequestRef.current = requestId;
    renameInFlightRef.current = true;
    setRenameError(null);
    setEditingSurface(null);
    setNameDraft(nextName);
    mergeTable({
      name: nextName,
    });

    try {
      const updated = await sdk.tables.update({
        id: previousTable.id,
        values: {
          name: nextName,
        },
      });
      if (renameRequestRef.current !== requestId) {
        return;
      }

      mergeTable({
        createdAt: updated.createdAt,
        id: updated.id,
        name: updated.name,
        projectId: updated.projectId,
        updatedAt: updated.updatedAt,
      });
      setNameDraft(updated.name);
    } catch (error) {
      if (renameRequestRef.current !== requestId) {
        return;
      }

      mergeTable(previousTable);
      setNameDraft(previousTable.name);
      setRenameError(getErrorMessage(error));
    } finally {
      if (renameRequestRef.current === requestId) {
        renameInFlightRef.current = false;
      }
    }
  }, [
    mergeTable,
    nameDraft,
    sdk,
  ]);

  const startEditingName = useCallback((surface: "crumb" | "title") => {
    if (renameInFlightRef.current) {
      return;
    }

    setEditingSurface(surface);
  }, []);

  const matchChangeTarget = useCallback(
    (descriptor: ChangeTargetDescriptor) => {
      if (
        descriptor.kind === "table" &&
        descriptor.tableId === selectedTableId
      ) {
        return true;
      }

      if (descriptor.kind === "row") {
        return rowsRef.current.some((row) => row.id === descriptor.rowId);
      }

      if (descriptor.kind === "column") {
        return columnsRef.current.some(
          (column) => column.id === descriptor.columnId,
        );
      }

      if (descriptor.kind === "cell") {
        return (
          rowsRef.current.some((row) => row.id === descriptor.rowId) &&
          columnsRef.current.some((column) => column.id === descriptor.columnId)
        );
      }

      return false;
    },
    [
      selectedTableId,
    ],
  );

  const revealChangeTarget = useCallback(
    (descriptor: ChangeTargetDescriptor) => {
      const api = gridRef.current?.api;

      if (!api || descriptor.kind === "table") {
        return descriptor.kind === "table";
      }

      const flashAfterReveal = (columnsToFlash: string[], rowId?: string) => {
        window.requestAnimationFrame(() => {
          const nextApi = gridRef.current?.api;

          if (!nextApi || columnsToFlash.length === 0) {
            return;
          }

          nextApi.flashCells({
            columns: columnsToFlash,
            rowNodes: rowId
              ? [
                  nextApi.getRowNode(rowId),
                ].filter(
                  (rowNode): rowNode is NonNullable<typeof rowNode> =>
                    rowNode !== undefined && rowNode !== null,
                )
              : undefined,
          });
        });
      };

      if (descriptor.kind === "row") {
        const rowIndex = rowsRef.current.findIndex(
          (row) => row.id === descriptor.rowId,
        );

        if (rowIndex < 0) {
          return false;
        }

        api.ensureIndexVisible(rowIndex);
        flashAfterReveal(
          columnsRef.current
            .slice(0, Math.min(6, columnsRef.current.length))
            .map((column) => column.id),
          descriptor.rowId,
        );
        return true;
      }

      if (descriptor.kind === "column") {
        if (
          !columnsRef.current.some(
            (column) => column.id === descriptor.columnId,
          )
        ) {
          return false;
        }

        api.ensureColumnVisible(descriptor.columnId);
        flashAfterReveal([
          descriptor.columnId,
        ]);
        return true;
      }

      if (descriptor.kind === "cell") {
        const rowIndex = rowsRef.current.findIndex(
          (row) => row.id === descriptor.rowId,
        );

        if (
          rowIndex < 0 ||
          !columnsRef.current.some(
            (column) => column.id === descriptor.columnId,
          )
        ) {
          return false;
        }

        api.ensureIndexVisible(rowIndex);
        api.ensureColumnVisible(descriptor.columnId);
        flashAfterReveal(
          [
            descriptor.columnId,
          ],
          descriptor.rowId,
        );
        return true;
      }

      return false;
    },
    [],
  );

  const findChangeTarget = useCallback((descriptor: ChangeTargetDescriptor) => {
    if (typeof document === "undefined") {
      return null;
    }

    const targetKey =
      descriptor.kind === "table"
        ? changeTargetKey.table(descriptor.tableId)
        : descriptor.kind === "row"
          ? changeTargetKey.row(descriptor.rowId)
          : descriptor.kind === "column"
            ? changeTargetKey.column(descriptor.columnId)
            : descriptor.kind === "cell"
              ? changeTargetKey.cell(descriptor.rowId, descriptor.columnId)
              : null;

    if (!targetKey) {
      return null;
    }

    const targetElement = document.querySelector<HTMLElement>(
      `[data-change-target="${escapeChangeTargetSelector(targetKey)}"]`,
    );

    if (!targetElement) {
      return null;
    }

    if (descriptor.kind === "column") {
      return (
        targetElement.closest<HTMLElement>(".ag-header-cell") ?? targetElement
      );
    }

    if (descriptor.kind === "row" || descriptor.kind === "cell") {
      return targetElement.closest<HTMLElement>(".ag-cell") ?? targetElement;
    }

    return targetElement;
  }, []);

  const changeSpotlightResolver = useMemo(
    () => ({
      findElement: findChangeTarget,
      match: matchChangeTarget,
      reveal: revealChangeTarget,
    }),
    [
      findChangeTarget,
      matchChangeTarget,
      revealChangeTarget,
    ],
  );

  useChangeSpotlightResolver(changeSpotlightResolver);

  return (
    <MarblePane
      crumbs={[
        {
          href: "/projects",
          id: "projects",
          label: "Projects",
        },
        {
          href: `/projects/${selectedTable.projectId}`,
          id: "project",
          label: selectedTable.projectName,
        },
        {
          id: "table",
          label: (
            <MarblePaneEditableCrumb
              disabled={false}
              editing={editingSurface === "crumb"}
              onCancel={stopEditingName}
              onChange={setNameDraft}
              onCommit={() => void commitName()}
              onEdit={() => startEditingName("crumb")}
              value={nameDraft}
            />
          ),
        },
      ]}
      frame="none"
    >
      <div className="relative flex w-full h-full min-h-0 flex overflow-hidden bg-zinc-50 font-sans text-zinc-900">
        <div className={cx("flex min-h-0 flex-1 flex-col w-full p-4")}>
          <div
            className="mb-3 w-full flex flex-wrap items-center justify-between gap-3 border-zinc-200"
            {...getChangeTargetProps(changeTargetKey.table(selectedTable.id))}
          >
            <div className="min-w-0 flex w-full flex-wrap items-center justify-between">
              <div className="flex flex-col items-start gap-1">
                <EditableName
                  className="-mx-1 max-w-full rounded-sm px-1 text-left font-medium text-xl tracking-tight text-zinc-950 transition-colors hover:text-orange-600"
                  disabled={false}
                  editing={editingSurface === "title"}
                  name={nameDraft}
                  onCancel={stopEditingName}
                  onChange={setNameDraft}
                  onCommit={() => void commitName()}
                  onEdit={() => startEditingName("title")}
                />
                <span className="text-xs text-zinc-500">
                  Last updated{" "}
                  {DATE_FORMATTER.format(new Date(selectedTable.updatedAt))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MarbleButton iconRight={PlayIcon}>Run all</MarbleButton>
                <MarbleButton>Export</MarbleButton>
              </div>
            </div>
          </div>

          {renameError ? (
            <MarbleAlert
              className="mb-3"
              tone="error"
            >
              {renameError}
            </MarbleAlert>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {selectedTableId ? (
              <div className="marble-table-grid min-h-0 flex-1">
                <style>{`
                    .marble-table-grid .ag-cell.ag-cell-inline-editing {
                      border-radius: 0;
                      box-shadow: none;
                      padding-left: 0 !important;
                      padding-right: 0 !important;
                    }

                    .marble-table-grid .ag-cell.ag-cell-inline-editing .ag-cell-edit-wrapper,
                    .marble-table-grid .ag-cell.ag-cell-inline-editing .ag-cell-editor {
                      height: 100%;
                      width: 100%;
                    }

                    .marble-table-grid .ag-cell.ag-cell-inline-editing .ag-input-field-input {
                      background: transparent;
                      border: 0 !important;
                      border-radius: 0;
                      box-shadow: none !important;
                      padding-left: var(
                        --marble-table-cell-padding-inline,
                        0px
                      ) !important;
                      padding-right: var(
                        --marble-table-cell-padding-inline,
                        0px
                      ) !important;
                    }

                    .marble-table-grid
                      .ag-cell.ag-cell-inline-editing
                      .ag-input-field-input:focus {
                      background: transparent;
                      border: 0 !important;
                      box-shadow: none !important;
                      outline: none;
                    }
                  `}</style>
                <AgGridReact
                  columnDefs={colDefs}
                  context={gridContext}
                  domLayout="normal"
                  getRowId={(params) => params.data._rowId as string}
                  headerHeight={34}
                  onCellContextMenu={onCellContextMenu}
                  onCellDoubleClicked={(event) => {
                    const columnId = event.colDef.field;
                    if (!columnId) return;
                    const col = columnsRef.current.find(
                      (c) => c.id === columnId,
                    );
                    if (!col) return;
                    if (isManualInputColumn(col)) return;
                    const rowId = event.data?._rowId as string;
                    const cell = cellsRef.current.find(
                      (c) => c.rowId === rowId && c.columnId === columnId,
                    );
                    setInspectedCell({
                      columnName: col.name,
                      manualInput: cell?.manualInput ?? null,
                      rowIndex: event.data?._rowIndex as number,
                      state: getCellState(cell),
                    });
                  }}
                  onCellValueChanged={onCellValueChanged}
                  preventDefaultOnContextMenu
                  ref={gridRef}
                  rowData={rowData}
                  rowHeight={32}
                  theme={gridTheme}
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
                Select or create a table to get started.
              </div>
            )}

            <div className="flex shrink-0 items-center justify-between gap-3 bg-zinc-50 pt-2">
              <div className="flex items-center gap-2">
                <MarbleButton
                  disabled={!selectedTableId || !hasRowCountInput}
                  onClick={handleAddRows}
                >
                  Add
                </MarbleButton>
                <MarbleInput
                  max="100"
                  min="1"
                  onChange={(event) => setRowCountInput(event.target.value)}
                  size="sm"
                  type="number"
                  value={rowCountInput}
                  wrapperClassName="w-16"
                />
                <span className="text-sm text-zinc-600">
                  {hasRowCountInput && rowCount === 1 ? "Row" : "Rows"}
                </span>
              </div>

              <MarbleButton
                onClick={() => setRunLogSheetOpen(true)}
                size="sm"
              >
                View run log
              </MarbleButton>
            </div>
          </div>
        </div>

        {sidebarMode.kind !== "closed" && (
          <ColumnSidebar
            columnSecretBindings={columnSecretBindings}
            columns={sortedColumns}
            currentTableId={selectedTableId}
            key={
              sidebarMode.kind === "edit"
                ? `edit-${sidebarMode.columnId}`
                : "create"
            }
            mode={sidebarMode}
            onClose={() =>
              setSidebarMode({
                kind: "closed",
              })
            }
            onCreateColumn={handleCreateColumn}
            onOpenSecrets={() => router.push("/secrets")}
            onUpdateColumn={handleUpdateColumn}
            programSecretBindings={programSecretBindings}
            programSecretDeclarations={programSecretDeclarations}
            programs={programs}
            referenceColumns={referenceColumns}
            secrets={secrets}
          />
        )}

        {/* Overlays */}
        {contextMenu && (
          <ContextMenu
            onClose={() => setContextMenu(null)}
            state={contextMenu}
          />
        )}
        <MarbleConfirmModal
          onClose={() => setConfirmState(null)}
          state={confirmState}
        />
        {inspectedCell && (
          <CellInspectorModal
            cell={inspectedCell}
            onClose={() => setInspectedCell(null)}
          />
        )}
        <RunLogSheet
          lines={runLog}
          onClear={() => setRunLog([])}
          onOpenChange={setRunLogSheetOpen}
          open={runLogSheetOpen}
        />
      </div>
    </MarblePane>
  );
};
export default TablePageView;
