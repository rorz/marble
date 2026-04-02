"use client";

import { createClient } from "@marble/supabase";
import {
  AllCommunityModule,
  type CellValueChangedEvent,
  type ColDef,
  type CustomCellRendererProps,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as actions from "./actions";

ModuleRegistry.registerModules([
  AllCommunityModule,
]);

// ── Types ───────────────────────────────────────────────

type Program = Awaited<ReturnType<typeof actions.listPrograms>>[number];
type TableInfo = Awaited<ReturnType<typeof actions.listTables>>[number];
type LoadedData = Awaited<ReturnType<typeof actions.loadTableData>>;
type Column = LoadedData["columns"][number];
type Row = LoadedData["rows"][number];
type Cell = LoadedData["cells"][number];
type Dependency = LoadedData["dependencies"][number];

// ── Theme ───────────────────────────────────────────────

const gridTheme = themeQuartz.withParams({
  backgroundColor: "#fafafa",
  foregroundColor: "#18181b",
  headerBackgroundColor: "#f4f4f5",
  borderColor: "#e4e4e7",
  rowHoverColor: "#f4f4f5",
  headerFontSize: 12,
  fontSize: 13,
  headerFontWeight: 500,
  spacing: 6,
  wrapperBorderRadius: 8,
  cellHorizontalPaddingScale: 0.8,
});

// ── Helpers ─────────────────────────────────────────────

type CellState =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      error: unknown;
      message: string;
    }
  | {
      ok: null;
    }
  | null;

function getCellState(cell: Cell | undefined): CellState {
  if (!cell) return null;
  return cell.state as CellState;
}

function displayCellValue(cell: Cell | undefined): string {
  const state = getCellState(cell);
  if (!state) return "";
  if (state.ok === null) return "⏳";
  if (state.ok === true) {
    const v = state.value;
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    return JSON.stringify(v);
  }
  if (state.ok === false) return `⚠ ${state.message}`;
  return cell?.manual_input ?? "";
}

function isManualInputColumn(column: Column): boolean {
  const config = column.program?.output_value_schema as {
    flags?: {
      allowManualInput?: boolean;
    };
  } | null;
  return config?.flags?.allowManualInput === true;
}

function shortId(id: string): string {
  return id.substring(0, 8);
}

type SchemaField = {
  key: string;
  type: string;
  title: string;
  required: boolean;
  enumValues?: string[];
  defaultValue?: string;
};

function buildFieldsFromSchema(schema: Record<string, unknown>): SchemaField[] {
  const props = (schema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const req = new Set((schema.required as string[] | undefined) ?? []);
  return Object.entries(props).map(([key, def]) => ({
    key,
    type: (def.type as string) ?? "string",
    title: (def.title as string) ?? key,
    required: req.has(key),
    enumValues: def.enum as string[] | undefined,
    defaultValue: def.default as string | undefined,
  }));
}

function coerceFieldValue(
  field: SchemaField,
  raw: string,
): unknown | undefined {
  const trimmed = raw.trim();
  if (trimmed === "" && !field.required) return undefined;

  switch (field.type) {
    case "object":
      if (trimmed === "") return {};
      try {
        return JSON.parse(trimmed);
      } catch {
        return {};
      }
    case "number":
    case "integer":
      return Number(trimmed) || 0;
    case "boolean":
      return trimmed === "true";
    case "array":
      if (trimmed === "") return [];
      try {
        return JSON.parse(trimmed);
      } catch {
        return [];
      }
    default:
      return raw;
  }
}

// ── Cell Inspector Modal ────────────────────────────────

type InspectedCell = {
  columnName: string;
  rowIndex: number;
  state: CellState;
  manualInput: string | null;
};

const JSON_TOKEN =
  /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

function tokenizeJson(json: string): React.ReactNode[] {
  const parts = json.split(JSON_TOKEN);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    let cls = "text-sky-700";
    if (part.startsWith('"')) {
      cls = part.endsWith(":")
        ? "text-zinc-900 font-medium"
        : "text-emerald-700";
    } else if (part === "true" || part === "false") {
      cls = "text-violet-600";
    } else if (part === "null") {
      cls = "text-zinc-400";
    }
    return (
      <span
        key={`${i}:${part.slice(0, 12)}`}
        className={cls}
      >
        {part}
      </span>
    );
  });
}

function CellInspectorModal({
  cell,
  onClose,
}: {
  cell: InspectedCell;
  onClose: () => void;
}) {
  const { state } = cell;
  const jsonStr = JSON.stringify(state, null, 2);
  const tokens = tokenizeJson(jsonStr);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      tabIndex={-1}
    >
      <div
        className="bg-white border border-zinc-200 rounded-lg w-full max-w-xl shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold">
              {cell.columnName}
              <span className="text-zinc-400 font-normal ml-2">
                Row {cell.rowIndex}
              </span>
            </h3>
            {state?.ok === false && (
              <span className="text-xs text-red-500 font-medium">Error</span>
            )}
            {state?.ok === true && (
              <span className="text-xs text-emerald-600 font-medium">
                Success
              </span>
            )}
            {state?.ok === null && (
              <span className="text-xs text-zinc-400 font-medium">Loading</span>
            )}
            {state === null && (
              <span className="text-xs text-zinc-400 font-medium">Not run</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {cell.manualInput !== null && (
            <div className="mb-4">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                Manual Input
              </div>
              <div className="bg-zinc-50 border border-zinc-200 rounded px-3 py-2 text-sm font-mono">
                {cell.manualInput || (
                  <span className="text-zinc-300">empty</span>
                )}
              </div>
            </div>
          )}

          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
            Cell State
          </div>
          {state === null ? (
            <div className="text-sm text-zinc-400 italic">
              No state — cell has not been run yet.
            </div>
          ) : (
            <pre className="bg-zinc-50 border border-zinc-200 rounded px-4 py-3 text-xs font-mono leading-relaxed overflow-auto whitespace-pre-wrap break-words">
              {tokens}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Cell Renderer ───────────────────────────────────────

function CellWithRunButton(props: CustomCellRendererProps) {
  const columnId = props.colDef?.field;
  const rowId = props.data?._rowId as string | undefined;
  const ctx = props.context as {
    runCell?: (columnId: string, rowId: string) => void;
  };

  const state = columnId
    ? (props.data?.[`_state:${columnId}`] as CellState)
    : null;
  const isLoading = state?.ok === null;
  const isFailed = state?.ok === false;
  const isNull = !state;

  return (
    <div className="group/cell flex items-center w-full h-full relative">
      {isLoading ? (
        <span className="flex-1 text-zinc-400 animate-pulse text-xs">
          running...
        </span>
      ) : isFailed ? (
        <span
          className="flex-1 overflow-hidden text-ellipsis text-red-500 text-xs"
          title={state.message}
        >
          ⚠ {state.message}
        </span>
      ) : isNull ? (
        <span className="flex-1 text-zinc-300 text-xs">—</span>
      ) : (
        <span className="flex-1 overflow-hidden text-ellipsis">
          {props.valueFormatted ?? props.value}
        </span>
      )}
      {columnId && rowId && !isLoading && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            ctx.runCell?.(columnId, rowId);
          }}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-sm border border-zinc-200 bg-white cursor-pointer items-center justify-center text-[8px] text-orange-600 leading-none hidden group-hover/cell:flex"
          title="Run this cell"
        >
          ▶
        </button>
      )}
    </div>
  );
}

// ── Component ───────────────────────────────────────────

export default function DemoPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [, setDependencies] = useState<Dependency[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [runLog, setRunLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inspectedCell, setInspectedCell] = useState<InspectedCell | null>(
    null,
  );

  const gridRef = useRef<AgGridReact>(null);

  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const cellMap = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const cell of cells) {
      map.set(`${cell.row_id}:${cell.column_id}`, cell);
    }
    return map;
  }, [
    cells,
  ]);

  // ── Load data ─────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const [t, p] = await Promise.all([
        actions.listTables(),
        actions.listPrograms(),
      ]);
      setTables(t);
      setPrograms(p);
      if (t.length > 0) setSelectedTableId(t[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedTableId) return;
    setLoading(true);
    actions.loadTableData(selectedTableId).then((data) => {
      setColumns(data.columns);
      setRows(data.rows);
      setCells(data.cells);
      setDependencies(data.dependencies);
      setLoading(false);
    });
  }, [
    selectedTableId,
  ]);

  // ── Realtime ──────────────────────────────────────────

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !selectedTableId || columns.length === 0) return;

    const supabase = createClient(url, key);
    const columnIds = new Set(columns.map((c) => c.id));

    const channel = supabase
      .channel(`cells:${selectedTableId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cell",
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Cell;
            if (!columnIds.has(updated.column_id)) return;
            setCells((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c)),
            );
          } else if (payload.eventType === "INSERT") {
            const inserted = payload.new as Cell;
            if (!columnIds.has(inserted.column_id)) return;
            setCells((prev) => {
              if (prev.some((c) => c.id === inserted.id)) return prev;
              return [
                ...prev,
                inserted,
              ];
            });
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as {
              id: string;
            };
            setCells((prev) => prev.filter((c) => c.id !== deleted.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    selectedTableId,
    columns,
  ]);

  // ── AG Grid config ────────────────────────────────────

  const sortedColumns = useMemo(
    () =>
      [
        ...columns,
      ].sort((a, b) => a.index - b.index),
    [
      columns,
    ],
  );

  const colDefs = useMemo<ColDef[]>(() => {
    return [
      {
        headerName: "#",
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        width: 52,
        pinned: "left" as const,
        sortable: false,
        suppressMovable: true,
        cellStyle: {
          color: "#666",
          fontFamily: "var(--font-geist-mono)",
        },
      },
      ...sortedColumns.map((col) => {
        const editable = isManualInputColumn(col);
        return {
          headerName: col.name,
          headerTooltip: col.program?.name,
          field: col.id,
          editable,
          cellRenderer: CellWithRunButton,
          cellStyle: {
            background: editable ? "#f4f4f5" : "transparent",
            fontFamily: "var(--font-geist-mono)",
          },
        } satisfies ColDef;
      }),
    ];
  }, [
    sortedColumns,
  ]);

  const rowData = useMemo(() => {
    return rows.map((row) => {
      const data: Record<string, unknown> = {
        _rowId: row.id,
        _rowIndex: row.index,
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

      const cell = cellsRef.current.find(
        (c) => c.row_id === rowId && c.column_id === columnId,
      );
      if (!cell) return;

      setRunning(true);
      addLog(`▶ Cell edit → running "${col.name}" ...`);

      try {
        const result = await actions.executeRun({
          programId: col.program_id,
          cellId: cell.id,
          cellValue: String(event.newValue ?? ""),
        });
        addLog(`✓ "${col.name}" → ${JSON.stringify(result.output)}`);
      } catch (err) {
        addLog(
          `✗ "${col.name}" → ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setRunning(false);
      }
    },
    [
      addLog,
    ],
  );

  const runCell = useCallback(
    async (columnId: string, rowId: string) => {
      const col = columnsRef.current.find((c) => c.id === columnId);
      if (!col) return;

      const cell = cellsRef.current.find(
        (c) => c.row_id === rowId && c.column_id === columnId,
      );
      if (!cell) return;

      setRunning(true);
      addLog(`▶ Re-running "${col.name}" ...`);

      try {
        const result = await actions.executeRun({
          programId: col.program_id,
          cellId: cell.id,
        });
        addLog(`✓ "${col.name}" → ${JSON.stringify(result.output)}`);
      } catch (err) {
        addLog(
          `✗ "${col.name}" → ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setRunning(false);
      }
    },
    [
      addLog,
    ],
  );

  const gridContext = useMemo(
    () => ({
      runCell,
    }),
    [
      runCell,
    ],
  );

  const handleRunAll = useCallback(async () => {
    setRunning(true);
    setRunLog([]);

    const currentCells = cellsRef.current;
    const currentColumns = columnsRef.current;
    const currentRows = rowsRef.current;

    const sorted = [
      ...currentColumns,
    ].sort((a, b) => a.index - b.index);

    const cellLookup = new Map<string, Cell>();
    for (const cell of currentCells) {
      cellLookup.set(`${cell.row_id}:${cell.column_id}`, cell);
    }

    for (const col of sorted) {
      if (isManualInputColumn(col)) {
        addLog(`skip  "${col.name}" — user input`);
        continue;
      }

      for (const row of currentRows) {
        const cell = cellLookup.get(`${row.id}:${col.id}`);
        if (!cell) continue;

        try {
          const result = await actions.executeRun({
            programId: col.program_id,
            cellId: cell.id,
          });
          addLog(
            `✓ "${col.name}" × Row ${row.index} → ${JSON.stringify(result.output)}`,
          );
        } catch (err) {
          addLog(
            `✗ "${col.name}" × Row ${row.index} → ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    setRunning(false);
  }, [
    addLog,
  ]);

  // ── CRUD handlers ─────────────────────────────────────

  const handleAddRow = useCallback(async () => {
    if (!selectedTableId) return;
    const { row, cells: newCells } = await actions.createRow(selectedTableId);
    setRows((prev) => [
      ...prev,
      row,
    ]);
    setCells((prev) => [
      ...prev,
      ...(newCells as Cell[]),
    ]);
  }, [
    selectedTableId,
  ]);

  const handleCreateTable = useCallback(async () => {
    const table = await actions.createTable();
    setTables((prev) => [
      ...prev,
      table,
    ]);
    setSelectedTableId(table.id);
  }, []);

  const handleDeleteColumn = useCallback(async (columnId: string) => {
    await actions.deleteColumn(columnId);
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    setCells((prev) => prev.filter((c) => c.column_id !== columnId));
    setDependencies((prev) =>
      prev.filter(
        (d) =>
          d.source_column_id !== columnId && d.target_column_id !== columnId,
      ),
    );
  }, []);

  const handleDeleteRow = useCallback(async (rowId: string) => {
    await actions.deleteRow(rowId);
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setCells((prev) => prev.filter((c) => c.row_id !== rowId));
  }, []);

  const handleCreateColumn = useCallback(
    async (input: {
      name: string;
      program_id: string;
      input_template: string;
    }) => {
      if (!selectedTableId) return;
      const {
        column,
        cells: newCells,
        dependencies: newDeps,
      } = await actions.createColumn({
        table_id: selectedTableId,
        ...input,
      });
      setColumns((prev) => [
        ...prev,
        column,
      ]);
      setCells((prev) => [
        ...prev,
        ...(newCells as Cell[]),
      ]);
      setDependencies((prev) => [
        ...prev,
        ...(newDeps as Dependency[]),
      ]);
    },
    [
      selectedTableId,
    ],
  );

  // ── Render ────────────────────────────────────────────

  if (loading && tables.length === 0) {
    return (
      <div className="bg-zinc-50 text-zinc-500 min-h-screen flex items-center justify-center font-mono text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-zinc-50 text-zinc-900 min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-zinc-200 px-5 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold tracking-tight">
          marble
          <span className="text-zinc-500 font-normal ml-2 text-sm">demo</span>
        </h1>

        {running && (
          <span className="text-orange-400 text-xs font-mono animate-pulse">
            running...
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <select
            className="bg-white border border-zinc-300 rounded px-2 py-1 text-sm"
            value={selectedTableId ?? ""}
            onChange={(e) => setSelectedTableId(e.target.value)}
          >
            {tables.map((t) => (
              <option
                key={t.id}
                value={t.id}
              >
                Table {shortId(t.id)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateTable}
            className="bg-zinc-200 hover:bg-zinc-300 border border-zinc-300 rounded px-2.5 py-1 text-sm transition-colors"
          >
            + Table
          </button>
          <button
            type="button"
            onClick={handleAddRow}
            disabled={!selectedTableId}
            className="bg-zinc-200 hover:bg-zinc-300 disabled:opacity-40 border border-zinc-300 rounded px-2.5 py-1 text-sm transition-colors"
          >
            + Row
          </button>
          <button
            type="button"
            onClick={handleRunAll}
            disabled={!selectedTableId || columns.length === 0 || running}
            className="bg-orange-700 hover:bg-orange-600 disabled:opacity-40 border border-orange-600 rounded px-3 py-1 text-sm font-medium transition-colors text-white"
          >
            Run All
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex min-h-0">
        {/* Grid + log panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-4">
            {selectedTableId ? (
              <div className="h-full">
                <AgGridReact
                  ref={gridRef}
                  theme={gridTheme}
                  columnDefs={colDefs}
                  rowData={rowData}
                  context={gridContext}
                  onCellValueChanged={onCellValueChanged}
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
                      (c) => c.row_id === rowId && c.column_id === columnId,
                    );
                    setInspectedCell({
                      columnName: col.name,
                      rowIndex: event.data?._rowIndex as number,
                      state: getCellState(cell),
                      manualInput: cell?.manual_input ?? null,
                    });
                  }}
                  domLayout={rowData.length < 20 ? "autoHeight" : "normal"}
                  headerHeight={34}
                  rowHeight={32}
                  getRowId={(params) => params.data._rowId as string}
                />
              </div>
            ) : (
              <div className="text-zinc-500 text-sm flex items-center justify-center h-32">
                Select or create a table to get started.
              </div>
            )}
          </div>

          {/* Row management */}
          {rows.length > 0 && (
            <div className="border-t border-zinc-200 px-5 py-2">
              <div className="flex flex-wrap gap-1.5">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="bg-white border border-zinc-200 rounded px-2 py-1 text-xs flex items-center gap-1.5"
                  >
                    <span className="text-zinc-500 font-mono">
                      Row {row.index}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row.id)}
                      className="text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Run log */}
          {runLog.length > 0 && (
            <div className="border-t border-zinc-200 px-5 py-3 max-h-48 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Log
                </h3>
                <button
                  type="button"
                  onClick={() => setRunLog([])}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  clear
                </button>
              </div>
              <pre className="text-xs font-mono space-y-0.5">
                {runLog.map((line, i) => (
                  <div
                    key={`${i}-${line.slice(0, 20)}`}
                    className={
                      line.includes("✗")
                        ? "text-red-400"
                        : line.includes("✓")
                          ? "text-green-600"
                          : line.includes("skip")
                            ? "text-blue-500"
                            : "text-zinc-500"
                    }
                  >
                    {line}
                  </div>
                ))}
              </pre>
            </div>
          )}
        </div>

        {/* Column sidebar */}
        <ColumnSidebar
          columns={sortedColumns}
          programs={programs}
          onCreateColumn={handleCreateColumn}
          onDeleteColumn={handleDeleteColumn}
        />
      </div>

      {inspectedCell && (
        <CellInspectorModal
          cell={inspectedCell}
          onClose={() => setInspectedCell(null)}
        />
      )}
    </div>
  );
}

// ── Column Sidebar ──────────────────────────────────────

function ColumnSidebar({
  columns,
  programs,
  onCreateColumn,
  onDeleteColumn,
}: {
  columns: Column[];
  programs: Program[];
  onCreateColumn: (input: {
    name: string;
    program_id: string;
    input_template: string;
  }) => Promise<void>;
  onDeleteColumn: (columnId: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [fieldValues, setFieldValues] = useState<
    Record<
      string,
      {
        mode: "static" | "column";
        value: string;
      }
    >
  >({});
  const [saving, setSaving] = useState(false);

  const selectedProgram = programs.find((p) => p.id === programId);
  const schema = selectedProgram?.input_payload_schema as Record<
    string,
    unknown
  > | null;
  const fields = schema ? buildFieldsFromSchema(schema) : [];
  const hasManualInput = (() => {
    const config = selectedProgram?.output_value_schema as {
      flags?: {
        allowManualInput?: boolean;
      };
    } | null;
    return config?.flags?.allowManualInput === true;
  })();

  useEffect(() => {
    if (!selectedProgram) {
      setFieldValues({});
      return;
    }
    const s = selectedProgram.input_payload_schema as Record<string, unknown>;
    const fs = s ? buildFieldsFromSchema(s) : [];
    const defaults: Record<
      string,
      {
        mode: "static" | "column";
        value: string;
      }
    > = {};
    for (const f of fs) {
      defaults[f.key] = {
        mode: "static",
        value: f.defaultValue ?? f.enumValues?.[0] ?? "",
      };
    }
    setFieldValues(defaults);
  }, [
    selectedProgram,
  ]);

  const handleSave = async () => {
    if (!name.trim() || !programId) return;

    const template: Record<string, unknown> = {};
    for (const [key, fv] of Object.entries(fieldValues)) {
      if (fv.mode === "column") {
        template[`${key}.$`] = `$.columns.${fv.value}.value`;
      } else {
        const field = fields.find((f) => f.key === key);
        if (!field) continue;
        const coerced = coerceFieldValue(field, fv.value);
        if (coerced !== undefined) template[key] = coerced;
      }
    }

    setSaving(true);
    try {
      await onCreateColumn({
        name: name.trim(),
        program_id: programId,
        input_template: JSON.stringify(template),
      });
      setName("");
      setProgramId("");
      setFieldValues({});
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="w-80 border-l border-zinc-200 flex flex-col bg-zinc-50 shrink-0">
      <div className="px-4 py-2.5 border-b border-zinc-200">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Columns
        </h2>
      </div>
      <div className="flex-1 overflow-auto">
        {columns.length === 0 && (
          <div className="text-zinc-400 text-xs px-4 py-6 text-center">
            No columns yet.
          </div>
        )}
        {columns.map((col) => (
          <div
            key={col.id}
            className="px-4 py-2.5 border-b border-zinc-100 flex items-center gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-800 truncate">{col.name}</div>
              <div className="text-[10px] text-zinc-400 flex gap-2 mt-0.5">
                <span>{col.program?.name ?? "—"}</span>
                {isManualInputColumn(col) && (
                  <span className="text-orange-600">input</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDeleteColumn(col.id)}
              className="text-zinc-400 hover:text-red-400 transition-colors text-sm"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add column form */}
      <div className="border-t border-zinc-300 bg-zinc-100 p-4 space-y-3 max-h-[50vh] overflow-auto">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Add Column
        </h3>

        <label className="block">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Uppercased"
            className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-sm focus:border-orange-600 focus:outline-none mt-0.5"
          />
        </label>

        <label className="block">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Program
          </span>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-sm focus:border-orange-600 focus:outline-none mt-0.5"
          >
            <option value="">Select program...</option>
            {programs.map((p) => (
              <option
                key={p.id}
                value={p.id}
              >
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {hasManualInput && (
          <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2.5 py-1.5">
            This program reads from cell.manualInputValue — cells will be
            editable.
          </div>
        )}

        {fields.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
              Input Template
            </span>
            {fields.map((f) => {
              const fv = fieldValues[f.key] ?? {
                mode: "static",
                value: "",
              };
              return (
                <div
                  key={f.key}
                  className="bg-zinc-100 rounded p-2.5 space-y-1.5 border border-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-orange-600">
                      {f.key}
                    </span>
                    <span className="text-[10px] text-zinc-500">{f.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`mode-${f.key}`}
                        checked={fv.mode === "static"}
                        onChange={() =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.key]: {
                              mode: "static",
                              value: f.defaultValue ?? f.enumValues?.[0] ?? "",
                            },
                          }))
                        }
                        className="accent-orange-500"
                      />
                      Static
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`mode-${f.key}`}
                        checked={fv.mode === "column"}
                        onChange={() =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.key]: {
                              mode: "column",
                              value: columns[0]?.id ?? "",
                            },
                          }))
                        }
                        className="accent-orange-500"
                      />
                      From column
                    </label>
                  </div>
                  {fv.mode === "static" ? (
                    f.enumValues ? (
                      <select
                        value={fv.value}
                        onChange={(e) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.key]: {
                              ...fv,
                              value: e.target.value,
                            },
                          }))
                        }
                        className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-xs"
                      >
                        {f.enumValues.map((v) => (
                          <option
                            key={v}
                            value={v}
                          >
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={fv.value}
                        onChange={(e) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.key]: {
                              ...fv,
                              value: e.target.value,
                            },
                          }))
                        }
                        placeholder={
                          f.type === "object"
                            ? f.required
                              ? '{"key": "value"}'
                              : "leave blank or JSON"
                            : f.type === "array"
                              ? "[]"
                              : undefined
                        }
                        className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-xs"
                      />
                    )
                  ) : (
                    <select
                      value={fv.value}
                      onChange={(e) =>
                        setFieldValues((prev) => ({
                          ...prev,
                          [f.key]: {
                            ...fv,
                            value: e.target.value,
                          },
                        }))
                      }
                      className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-xs"
                    >
                      <option
                        value=""
                        disabled
                      >
                        Pick a column...
                      </option>
                      {columns.map((col) => (
                        <option
                          key={col.id}
                          value={col.id}
                        >
                          {col.name}
                          {isManualInputColumn(col) ? " (input)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || !programId || saving}
          className="w-full bg-orange-700 hover:bg-orange-600 disabled:opacity-40 border border-orange-600 rounded px-3 py-1.5 text-sm font-medium transition-colors text-white"
        >
          {saving ? "Creating..." : "Create Column"}
        </button>
      </div>
    </aside>
  );
}
