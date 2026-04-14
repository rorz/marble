"use client";

import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import {
  MarbleButton,
  MarbleFieldLabel,
  MarbleInput,
  MarbleSelect,
  MarbleTextarea,
} from "@marble/ui";
import {
  AllCommunityModule,
  type CellContextMenuEvent,
  type CellValueChangedEvent,
  type ColDef,
  type IHeaderParams,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import Link from "next/link";
import Prism from "prismjs";
import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Editor from "react-simple-code-editor";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import SignOutButton from "../../../sign-out-button";
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

type SidebarMode =
  | {
      kind: "closed";
    }
  | {
      kind: "create";
    }
  | {
      kind: "edit";
      columnId: string;
    };

type ContextMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

type ContextMenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
} | null;

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
} | null;

type GridContext = {
  runCell: (columnId: string, rowId: string) => void;
  onHeaderClick: (columnId: string) => void;
  onHeaderContextMenu: (columnId: string, x: number, y: number) => void;
  openCreateColumn: () => void;
  activeColumnId: string | null;
};

// ── Theme ───────────────────────────────────────────────

const gridTheme = themeQuartz.withParams({
  backgroundColor: "#fafafa",
  borderColor: "#e4e4e7",
  cellHorizontalPaddingScale: 0.8,
  fontSize: 13,
  foregroundColor: "#18181b",
  headerBackgroundColor: "#f4f4f5",
  headerFontSize: 12,
  headerFontWeight: 500,
  rowHoverColor: "#f4f4f5",
  spacing: 6,
  wrapperBorderRadius: 8,
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

function getProgramOutputConfig(
  programVersion: unknown,
): Record<string, unknown> | null {
  if (!programVersion || typeof programVersion !== "object") return null;
  const record = programVersion as Record<string, unknown>;
  const config = record.output_config;
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  return config as Record<string, unknown>;
}

function getProgramInputSchema(
  programVersion: unknown,
): Record<string, unknown> | null {
  if (!programVersion || typeof programVersion !== "object") return null;
  const record = programVersion as Record<string, unknown>;
  const schema = record.input_schema;
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    return null;
  return schema as Record<string, unknown>;
}

function isManualInputColumn(column: Column): boolean {
  const config = getProgramOutputConfig(column.program_version) as {
    flags?: {
      allowManualInput?: boolean;
    };
  } | null;
  return config?.flags?.allowManualInput === true;
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
    defaultValue: def.default as string | undefined,
    enumValues: def.enum as string[] | undefined,
    key,
    required: req.has(key),
    title: (def.title as string) ?? key,
    type: (def.type as string) ?? "string",
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

function getTableIdFromChange(
  payload: {
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  },
  key = "table_id",
) {
  const nextValue = payload.new[key];

  if (typeof nextValue === "string") {
    return nextValue;
  }

  const previousValue = payload.old[key];

  if (typeof previousValue === "string") {
    return previousValue;
  }

  return null;
}

const COL_REF_PATTERN = /^\$\.columns\.([a-f0-9-]+)\./;

function parseTemplateToFieldValues(
  templateJson: string,
  fields: SchemaField[],
  columns: Column[],
): Record<
  string,
  {
    mode: "static" | "column";
    value: string;
  }
> {
  let template: Record<string, unknown> = {};
  try {
    template = JSON.parse(templateJson);
  } catch {
    template = {};
  }

  const result: Record<
    string,
    {
      mode: "static" | "column";
      value: string;
    }
  > = {};

  for (const field of fields) {
    const dynamicKey = `${field.key}.$`;
    if (dynamicKey in template) {
      const ref = template[dynamicKey] as string;
      const match = ref.match(COL_REF_PATTERN);
      if (match) {
        result[field.key] = {
          mode: "column",
          value: match[1],
        };
        continue;
      }
    }
    if (field.key in template) {
      const val = template[field.key];
      let strVal = typeof val === "string" ? val : JSON.stringify(val);

      // Reverse interpolation tags: {{$.columns.<id>.value.foo}} -> {{Column Name.foo}}
      strVal = strVal.replace(
        /\{\{\$\.columns\.([a-f0-9-]+)\.value([^}]*)\}\}/g,
        (match, id, restPath) => {
          const col = columns.find((c) => c.id === id);
          if (col) return `{{${col.name}${restPath}}}`;
          return match;
        },
      );

      result[field.key] = {
        mode: "static",
        value: strVal,
      };
    } else {
      result[field.key] = {
        mode: "static",
        value: field.defaultValue ?? field.enumValues?.[0] ?? "",
      };
    }
  }

  return result;
}

// ── Context Menu ────────────────────────────────────────

function ContextMenu({
  state,
  onClose,
}: {
  state: NonNullable<ContextMenuState>;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    onClose,
  ]);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss pattern */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss pattern */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-[61] min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        style={{
          left: state.x,
          top: state.y,
        }}
      >
        {state.items.map((item) => (
          <button
            className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 ${
              item.danger ? "text-red-600 hover:bg-red-50" : "text-zinc-700"
            }`}
            key={item.label}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── Confirm Modal ───────────────────────────────────────

function ConfirmModal({
  state,
  onClose,
}: {
  state: NonNullable<ConfirmState>;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      tabIndex={-1}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <h3 className="mb-2 font-semibold text-sm">{state.title}</h3>
        <p className="mb-5 text-sm text-zinc-600">{state.message}</p>
        <div className="flex items-center justify-end gap-2">
          <MarbleButton onClick={onClose}>Cancel</MarbleButton>
          <MarbleButton
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            variant="red"
          >
            {state.confirmLabel}
          </MarbleButton>
        </div>
      </div>
    </div>
  );
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
        className={cls}
        // biome-ignore lint/suspicious/noArrayIndexKey: log
        key={`${i}:${part.slice(0, 12)}`}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      tabIndex={-1}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-lg border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <div className="flex shrink-0 items-center justify-between border-zinc-200 border-b px-5 py-3">
          <div>
            <h3 className="font-semibold text-sm">
              {cell.columnName}
              <span className="ml-2 font-normal text-zinc-400">
                Row {cell.rowIndex}
              </span>
            </h3>
            {state?.ok === false && (
              <span className="font-medium text-red-500 text-xs">Error</span>
            )}
            {state?.ok === true && (
              <span className="font-medium text-emerald-600 text-xs">
                Success
              </span>
            )}
            {state?.ok === null && (
              <span className="font-medium text-xs text-zinc-400">Loading</span>
            )}
            {state === null && (
              <span className="font-medium text-xs text-zinc-400">Not run</span>
            )}
          </div>
          <button
            className="text-lg text-zinc-400 leading-none hover:text-zinc-700"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {cell.manualInput !== null && (
            <div className="mb-4">
              <div className="mb-1 text-[10px] text-zinc-500 uppercase tracking-wider">
                Manual Input
              </div>
              <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm">
                {cell.manualInput || (
                  <span className="text-zinc-300">empty</span>
                )}
              </div>
            </div>
          )}

          <div className="mb-1 text-[10px] text-zinc-500 uppercase tracking-wider">
            Cell State
          </div>
          {state === null ? (
            <div className="text-sm text-zinc-400 italic">
              No state — cell has not been run yet.
            </div>
          ) : (
            <pre className="overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-xs leading-relaxed">
              {tokens}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Custom Column Header ────────────────────────────────

function ColumnHeader(props: IHeaderParams) {
  const ctx = props.context as GridContext;
  const columnId = props.column.getColId();
  const isActive = ctx.activeColumnId === columnId;

  return (
    <button
      className={`flex h-full w-full cursor-pointer select-none items-center border-none bg-transparent p-0 text-left text-inherit transition-colors ${
        isActive ? "font-semibold text-orange-700" : ""
      }`}
      onClick={() => ctx.onHeaderClick(columnId)}
      onContextMenu={(e) => {
        e.preventDefault();
        ctx.onHeaderContextMenu(columnId, e.clientX, e.clientY);
      }}
      type="button"
    >
      <span className="truncate">{props.displayName}</span>
    </button>
  );
}

// ── Add Column Button (rendered as a header) ────────────

function AddColumnButton(props: IHeaderParams) {
  const ctx = props.context as GridContext;

  return (
    <button
      className="group/add flex h-full w-full cursor-pointer items-center justify-center border-none bg-transparent p-0"
      onClick={() => ctx.openCreateColumn()}
      type="button"
    >
      <span className="font-medium text-sm text-zinc-400 leading-none transition-colors group-hover/add:text-orange-600">
        +
      </span>
    </button>
  );
}

// ── Cell Renderer ───────────────────────────────────────

function CellRunningIndicator() {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-0 overflow-hidden bg-zinc-100/80 shadow-[inset_0_0_8px_rgba(0,0,0,0.05)]"
      style={{
        left: "calc(var(--ag-cell-horizontal-padding, 16px) * -1)",
        right: "calc(var(--ag-cell-horizontal-padding, 16px) * -1)",
      }}
    >
      <style>{`
        @keyframes motlo-swathe {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(500%); }
        }
        @keyframes motlo-climb {
          0% { transform: translateY(0); }
          100% { transform: translateY(-8px); }
        }
      `}</style>

      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-zinc-200/0 via-zinc-200/80 to-zinc-200/0" />

      <div className="absolute inset-0 overflow-hidden opacity-20 mix-blend-overlay">
        <div
          className="h-[200%] w-full"
          style={{
            animation: "motlo-climb 0.8s linear infinite",
            backgroundImage:
              "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "4px 4px",
          }}
        />
      </div>

      <div
        className="absolute top-[-50%] bottom-[-50%] flex w-16"
        style={{
          animation: "motlo-swathe 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          transformOrigin: "center",
        }}
      >
        <div className="h-full w-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-orange-400/30 to-orange-500/80 blur-[2px]" />
        <div className="h-full w-[2px] translate-x-[-2px] skew-x-[-20deg] bg-orange-500 shadow-[0_0_12px_3px_rgba(249,115,22,0.9)]" />
      </div>
    </div>
  );
}

function CellWithRunButton(props: CustomCellRendererProps) {
  const columnId = props.colDef?.field;
  const rowId = props.data?._rowId as string | undefined;
  const ctx = props.context as GridContext;

  const state = columnId
    ? (props.data?.[`_state:${columnId}`] as CellState)
    : null;
  const isLoading = state?.ok === null;
  const isFailed = state?.ok === false;
  const isNull = !state;

  return (
    <div className="group/cell relative flex h-full w-full items-center">
      {isLoading ? (
        <CellRunningIndicator />
      ) : isFailed ? (
        <span
          className="flex-1 overflow-hidden text-ellipsis text-red-500 text-xs"
          title={state.message}
        >
          ⚠ {state.message}
        </span>
      ) : isNull ? (
        <span className="flex-1 text-xs text-zinc-300">—</span>
      ) : (
        <span className="flex-1 overflow-hidden text-ellipsis">
          {props.valueFormatted ?? props.value}
        </span>
      )}
      {columnId && rowId && !isLoading && (
        <button
          className="absolute top-1/2 right-0.5 hidden h-[18px] w-[18px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm border border-zinc-200 bg-white text-[8px] text-orange-600 leading-none group-hover/cell:flex"
          onClick={(e) => {
            e.stopPropagation();
            ctx.runCell?.(columnId, rowId);
          }}
          title="Run this cell"
          type="button"
        >
          ▶
        </button>
      )}
    </div>
  );
}

function ClickToEditTitle({
  value,
  onChange,
}: {
  value: string;
  onChange: (newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempValue(value);
  }, [
    value,
  ]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [
    editing,
  ]);

  const handleSave = () => {
    setEditing(false);
    if (tempValue.trim() && tempValue !== value) {
      onChange(tempValue.trim());
    } else {
      setTempValue(value);
    }
  };

  if (editing) {
    return (
      <input
        className="w-48 border-orange-500 border-b bg-transparent px-1 font-medium text-neutral-900 text-sm placeholder-neutral-400 outline-none transition-all focus:border-b-2"
        onBlur={handleSave}
        onChange={(e) => setTempValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setTempValue(value);
            setEditing(false);
          }
        }}
        placeholder="Table Name"
        ref={inputRef}
        type="text"
        value={tempValue}
      />
    );
  }

  return (
    <button
      className="max-w-[200px] cursor-text truncate rounded px-1.5 py-0.5 text-left font-medium text-neutral-600 text-sm transition-colors hover:bg-neutral-200 hover:text-neutral-900"
      onClick={() => setEditing(true)}
      title="Click to edit"
      type="button"
    >
      {value || "Untitled Table"}
    </button>
  );
}

// ── Components ──────────────────────────────────────────

function InterpolationEditor({
  value,
  onChange,
  placeholder,
  columns,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  columns: Column[];
}) {
  // Custom prism grammar for our interpolation tags
  const grammar = useMemo(() => {
    return {
      interpolation: {
        inside: {
          "col-name": {
            alias: "keyword",
            // Match the column name component (which may include spaces)
            // It stops at the first unescaped dot, square bracket, or the opening/closing braces.
            pattern: /^([^{}.[\]]+)/,
          },
          "col-path": {
            alias: "property",
            // Match the property path dot-notation or array indexing
            pattern: /^[.[][^\s}]+/,
          },
          "invalid-text": {
            alias: "invalid",
            pattern: /[^}]+/,
          },
          "tag-close": {
            alias: "punctuation",
            pattern: /\}\}$/,
          },
          "tag-open": {
            alias: "punctuation",
            pattern: /^\{\{/,
          },
        },
        pattern: /\{\{[^}]+\}\}/,
      },
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded border border-zinc-300 bg-white text-xs transition-all focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500">
      <Editor
        className="min-h-[40px] font-mono"
        highlight={(code) => {
          let html = Prism.highlight(code, grammar, "interpolation");

          // Post-process the generated HTML to validate column names visually
          // Prism produces tokens like: <span class="token keyword col-name">enrich_email_with_apollo</span>
          const colNames = columns.map((c) => c.name);
          const regex = /<span class="token keyword col-name">([^<]+)<\/span>/g;
          html = html.replace(regex, (match, name) => {
            const isValid = colNames.some((c) => name === c);
            if (!isValid) {
              return `<span class="token keyword col-name invalid" title="Unrecognized column name">${name}</span>`;
            }
            return match;
          });

          return html;
        }}
        onValueChange={onChange}
        padding={8}
        placeholder={placeholder}
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
        }}
        textareaClassName="focus:outline-none"
        value={value}
      />
      <style>{`
        /* Custom Prism styles for interpolation */
        .token.interpolation { color: #ea580c; background: #fff7ed; border-radius: 2px; padding: 0 2px; }
        .token.tag-open, .token.tag-close { opacity: 0.5; }
        .token.col-name { font-weight: 600; }
        .token.col-name.invalid, .token.invalid-text { color: #a1a1aa; font-weight: normal; text-decoration: underline dotted #f87171; }
        .token.col-path { color: #9a3412 !important; }
      `}</style>
    </div>
  );
}

// ── Component ───────────────────────────────────────────

export default function TablePage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const selectedTableId = React.use(props.params).id;
  const [tables, setTables] = useState<TableInfo[]>([]);
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

  const [sidebarMode, setSidebarMode] = useState<SidebarMode>({
    kind: "closed",
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const gridRef = useRef<AgGridReact>(null);
  const realtimeClient = useMemo(() => createBrowserClient(), []);

  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const upsertLocalTable = useCallback((nextTable: TableInfo) => {
    setTables((prev) => {
      const existingIndex = prev.findIndex(
        (table) => table.id === nextTable.id,
      );

      if (existingIndex === -1) {
        const next = [
          ...prev,
          nextTable,
        ].sort((a, b) => a.created_at.localeCompare(b.created_at));
        tablesRef.current = next;
        return next;
      }

      const next = [
        ...prev,
      ];
      next[existingIndex] = {
        ...next[existingIndex],
        ...nextTable,
      };
      tablesRef.current = next;
      return next;
    });
  }, []);

  const removeLocalTable = useCallback((tableId: string) => {
    setTables((prev) => {
      const next = prev.filter((table) => table.id !== tableId);

      if (next.length === prev.length) {
        return prev;
      }

      tablesRef.current = next;
      return next;
    });
  }, []);

  const applyLoadedData = useCallback((data: LoadedData) => {
    columnsRef.current = data.columns;
    rowsRef.current = data.rows;
    cellsRef.current = data.cells;
    setColumns(data.columns);
    setRows(data.rows);
    setCells(data.cells);
    setDependencies(data.dependencies);
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
      const next = prev.filter((cell) => cell.row_id !== rowId);

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
      const next = prev.filter((cell) => cell.column_id !== columnId);

      if (next.length === prev.length) {
        return prev;
      }

      cellsRef.current = next;
      return next;
    });
    setDependencies((prev) =>
      prev.filter(
        (dependency) =>
          dependency.source_column_id !== columnId &&
          dependency.target_column_id !== columnId,
      ),
    );
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
      patchLocalCell(cellId, {
        ...(manualInput === undefined
          ? {}
          : {
              manual_input: manualInput,
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
              manual_input: manualInput,
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
              manual_input: manualInput,
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
      map.set(`${cell.row_id}:${cell.column_id}`, cell);
    }
    return map;
  }, [
    cells,
  ]);

  // ── Load data ─────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [t, p] = await Promise.all([
        actions.listTables(),
        actions.listPrograms(),
      ]);
      if (cancelled) return;
      setTables(t);
      setPrograms(p);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedTableId) return;
    let cancelled = false;

    setLoading(true);
    actions
      .loadTableData(selectedTableId)
      .then((data) => {
        if (cancelled) return;
        applyLoadedData(data);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load table data", error);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    applyLoadedData,
    selectedTableId,
  ]);

  // ── Realtime ──────────────────────────────────────────

  useEffect(() => {
    if (!selectedTableId || columns.length === 0) return;

    const columnIds = new Set(columns.map((column) => column.id));
    const pendingUpdates = new Map<string, Cell>();
    const pendingInserts = new Map<string, Cell>();
    const pendingDeletes = new Set<string>();
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (
        pendingInserts.size === 0 &&
        pendingUpdates.size === 0 &&
        pendingDeletes.size === 0
      ) {
        return;
      }

      setCells((prev) => {
        const next = [
          ...prev,
        ];
        let changed = false;

        if (pendingDeletes.size > 0) {
          const filtered = next.filter((cell) => !pendingDeletes.has(cell.id));

          if (filtered.length !== next.length) {
            next.length = 0;
            next.push(...filtered);
            changed = true;
          }
        }

        if (pendingUpdates.size > 0) {
          for (let index = 0; index < next.length; index += 1) {
            const updated = pendingUpdates.get(next[index].id);

            if (updated) {
              next[index] = updated;
              changed = true;
            }
          }
        }

        if (pendingInserts.size > 0) {
          const existingIds = new Set(next.map((cell) => cell.id));

          for (const inserted of pendingInserts.values()) {
            if (!existingIds.has(inserted.id)) {
              next.push(inserted);
              changed = true;
            }
          }
        }

        pendingUpdates.clear();
        pendingInserts.clear();
        pendingDeletes.clear();

        if (changed) {
          cellsRef.current = next;
        }

        return changed ? next : prev;
      });
    };

    const channel = realtimeClient
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

            if (!columnIds.has(updated.column_id)) {
              return;
            }

            pendingUpdates.set(updated.id, updated);
          } else if (payload.eventType === "INSERT") {
            const inserted = payload.new as Cell;

            if (!columnIds.has(inserted.column_id)) {
              return;
            }

            pendingInserts.set(inserted.id, inserted);
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as {
              id: string;
            };

            pendingDeletes.add(deleted.id);
          }

          if (flushTimeout) {
            return;
          }

          flushTimeout = setTimeout(() => {
            flushTimeout = null;
            flush();
          }, 100);
        },
      )
      .subscribe();

    return () => {
      if (flushTimeout) clearTimeout(flushTimeout);
      realtimeClient.removeChannel(channel);
    };
  }, [
    columns,
    realtimeClient,
    selectedTableId,
  ]);

  useEffect(() => {
    if (!selectedTableId) return;
    const channel = realtimeClient
      .channel(`table:${selectedTableId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table",
        },
        (payload) => {
          if (getTableIdFromChange(payload, "id") !== selectedTableId) {
            return;
          }

          startTransition(() => {
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              upsertLocalTable(payload.new as TableInfo);
            } else if (payload.eventType === "DELETE") {
              removeLocalTable((payload.old as TableInfo).id);
            }
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Table realtime channel failed", {
            selectedTableId,
          });
        }
      });

    return () => {
      realtimeClient.removeChannel(channel);
    };
  }, [
    realtimeClient,
    removeLocalTable,
    selectedTableId,
    upsertLocalTable,
  ]);

  useEffect(() => {
    if (!selectedTableId) return;

    const channel = realtimeClient
      .channel(`rows:${selectedTableId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "row",
        },
        (payload) => {
          if (getTableIdFromChange(payload) !== selectedTableId) {
            return;
          }

          startTransition(() => {
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              upsertLocalRow(payload.new as Row);
            } else if (payload.eventType === "DELETE") {
              removeLocalRow((payload.old as Row).id);
            }
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Row realtime channel failed", {
            selectedTableId,
          });
        }
      });

    return () => {
      realtimeClient.removeChannel(channel);
    };
  }, [
    realtimeClient,
    removeLocalRow,
    selectedTableId,
    upsertLocalRow,
  ]);

  useEffect(() => {
    if (!selectedTableId) return;

    const channel = realtimeClient
      .channel(`columns:${selectedTableId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "column",
        },
        (payload) => {
          if (getTableIdFromChange(payload) !== selectedTableId) {
            return;
          }

          startTransition(() => {
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              upsertLocalColumn(payload.new as Column);
            } else if (payload.eventType === "DELETE") {
              removeLocalColumn((payload.old as Column).id);
            }
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Column realtime channel failed", {
            selectedTableId,
          });
        }
      });

    return () => {
      realtimeClient.removeChannel(channel);
    };
  }, [
    removeLocalColumn,
    realtimeClient,
    selectedTableId,
    upsertLocalColumn,
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
        cellStyle: {
          color: "#666",
          fontFamily: "var(--font-geist-mono)",
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
            return {
              background: editable
                ? hasValue
                  ? "#ffffff"
                  : "#f4f4f5"
                : "transparent",
              fontFamily: "var(--font-geist-mono)",
            };
          },
          editable,
          field: col.id,
          headerComponent: ColumnHeader,
          headerName: col.name,
          headerTooltip: col.program_version?.program?.name,
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

      const cell = cellsRef.current.find(
        (c) => c.row_id === rowId && c.column_id === columnId,
      );
      if (!cell) return;

      const manualInput = String(event.newValue ?? "");

      setRunning(true);
      markCellAsRunning(cell.id, manualInput);
      addLog(`▶ Cell edit → running "${col.name}" ...`);

      try {
        const result = await actions.executeRun({
          cellId: cell.id,
          cellValue: manualInput,
          programId: col.program_version_id,
        });
        applyRunOutputToCell(cell.id, result.output, manualInput);
        addLog(`✓ "${col.name}" → ${JSON.stringify(result.output)}`);
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
      markCellAsRunning(cell.id);
      addLog(`▶ Re-running "${col.name}" ...`);

      try {
        const result = await actions.executeRun({
          cellId: cell.id,
          programId: col.program_version_id,
        });
        applyRunOutputToCell(cell.id, result.output);
        addLog(`✓ "${col.name}" → ${JSON.stringify(result.output)}`);
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
    ].sort((a, b) => a.idx - b.idx);

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
          markCellAsRunning(cell.id);
          const result = await actions.executeRun({
            cellId: cell.id,
            programId: col.program_version_id,
          });
          applyRunOutputToCell(cell.id, result.output);
          addLog(
            `✓ "${col.name}" × Row ${row.idx} → ${JSON.stringify(result.output)}`,
          );
        } catch (err) {
          applyClientErrorToCell(
            cell.id,
            err instanceof Error ? err.message : String(err),
          );
          addLog(
            `✗ "${col.name}" × Row ${row.idx} → ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    setRunning(false);
  }, [
    addLog,
    applyClientErrorToCell,
    applyRunOutputToCell,
    markCellAsRunning,
  ]);

  // ── CRUD handlers ─────────────────────────────────────

  const [rowCount, setRowCount] = useState(1);

  const handleAddRows = useCallback(async () => {
    if (!selectedTableId) return;
    const { rows: newRows, cells: newCells } = await actions.createRows(
      selectedTableId,
      rowCount,
    );
    setRows((prev) => [
      ...prev,
      ...newRows,
    ]);
    setCells((prev) => [
      ...prev,
      ...(newCells as Cell[]),
    ]);
  }, [
    selectedTableId,
    rowCount,
  ]);

  const handleRenameTable = useCallback(
    async (newName: string) => {
      if (!selectedTableId) return;
      try {
        const updated = await actions.updateTableName(selectedTableId, newName);
        setTables((prev) =>
          prev.map((t) =>
            t.id === selectedTableId
              ? {
                  ...t,
                  name: updated.name,
                }
              : t,
          ),
        );
      } catch (err) {
        console.error("Failed to rename table", err);
      }
    },
    [
      selectedTableId,
    ],
  );

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
        column as unknown as Column,
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

  const handleUpdateColumn = useCallback(
    async (input: {
      columnId: string;
      name?: string;
      program_id?: string;
      input_template?: string;
    }) => {
      const updated = await actions.updateColumn(input);
      setColumns((prev) =>
        prev.map((c) => (c.id === updated.id ? (updated as Column) : c)),
      );
    },
    [],
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

  if (loading && tables.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-mono text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans text-zinc-900">
      {/* Header */}
      <header className="flex items-center gap-4 border-zinc-200 border-b px-5 py-3">
        <h1 className="font-semibold text-lg tracking-tight">
          <Link
            className="transition-colors hover:text-orange-600"
            href="/tables"
          >
            marble
          </Link>
        </h1>

        <div className="mx-2 h-4 w-px bg-zinc-300" />

        {selectedTableId && (
          <div className="flex items-center gap-2">
            <Link
              className="rounded bg-zinc-100 p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-900"
              href="/tables"
              title="Back to tables"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
            </Link>
            <ClickToEditTitle
              onChange={handleRenameTable}
              value={
                tables.find((t) => t.id === selectedTableId)?.name ||
                "Untitled Table"
              }
            />
          </div>
        )}

        {running && (
          <span className="ml-4 animate-pulse font-mono text-orange-400 text-xs">
            running...
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Link
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            href="/events"
          >
            Events
          </Link>
          <Link
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            href="/profiles"
          >
            Profiles
          </Link>
          <Link
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            href="/internal/ui"
          >
            UI
          </Link>
          <SignOutButton />
        </div>
      </header>

      <div className="flex items-center justify-between border-zinc-200 border-b bg-white px-5 py-1.5">
        <div></div>
        <MarbleButton
          disabled={!selectedTableId || columns.length === 0 || running}
          onClick={handleRunAll}
          variant="orange"
        >
          Run All
        </MarbleButton>
      </div>

      {/* Main */}
      <div className="flex min-h-0 flex-1">
        {/* Grid + log panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-full flex-1 flex-col p-4">
            {selectedTableId ? (
              <div className="mb-4 min-h-0 flex-1">
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
                      (c) => c.row_id === rowId && c.column_id === columnId,
                    );
                    setInspectedCell({
                      columnName: col.name,
                      manualInput: cell?.manual_input ?? null,
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

            <div className="mt-2 flex shrink-0 justify-start">
              <div className="flex items-center gap-2">
                <MarbleButton
                  disabled={!selectedTableId}
                  onClick={handleAddRows}
                >
                  Add
                </MarbleButton>
                <MarbleInput
                  max="100"
                  min="1"
                  onChange={(e) =>
                    setRowCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  size="sm"
                  type="number"
                  value={rowCount}
                  wrapperClassName="w-16"
                />
                <span className="text-sm text-zinc-600">
                  {rowCount === 1 ? "Row" : "Rows"}
                </span>
              </div>
            </div>
          </div>

          {/* Run log */}
          {runLog.length > 0 && (
            <div className="max-h-48 overflow-auto border-zinc-200 border-t px-5 py-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-xs text-zinc-500 uppercase tracking-wider">
                  Log
                </h3>
                <button
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                  onClick={() => setRunLog([])}
                  type="button"
                >
                  clear
                </button>
              </div>
              <pre className="space-y-0.5 font-mono text-xs">
                {runLog.map((line, i) => (
                  <div
                    className={
                      line.includes("✗")
                        ? "text-red-400"
                        : line.includes("✓")
                          ? "text-green-600"
                          : line.includes("skip")
                            ? "text-blue-500"
                            : "text-zinc-500"
                    }
                    // biome-ignore lint/suspicious/noArrayIndexKey: log
                    key={`${i}-${line.slice(0, 20)}`}
                  >
                    {line}
                  </div>
                ))}
              </pre>
            </div>
          )}
        </div>

        {/* Column sidebar — only visible when creating or editing */}
        {sidebarMode.kind !== "closed" && (
          <ColumnSidebar
            columns={sortedColumns}
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
            onUpdateColumn={handleUpdateColumn}
            programs={programs}
          />
        )}
      </div>

      {/* Overlays */}
      {contextMenu && (
        <ContextMenu
          onClose={() => setContextMenu(null)}
          state={contextMenu}
        />
      )}
      {confirmState && (
        <ConfirmModal
          onClose={() => setConfirmState(null)}
          state={confirmState}
        />
      )}
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
  mode,
  columns,
  programs,
  onCreateColumn,
  onUpdateColumn,
  onClose,
}: {
  mode:
    | {
        kind: "create";
      }
    | {
        kind: "edit";
        columnId: string;
      };
  columns: Column[];
  programs: Program[];
  onCreateColumn: (input: {
    name: string;
    program_id: string;
    input_template: string;
  }) => Promise<void>;
  onUpdateColumn: (input: {
    columnId: string;
    name?: string;
    program_id?: string;
    input_template?: string;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const editingColumn =
    mode.kind === "edit"
      ? (columns.find((c) => c.id === mode.columnId) ?? null)
      : null;

  const initFieldValues = (): Record<
    string,
    {
      mode: "static" | "column";
      value: string;
    }
  > => {
    if (!editingColumn) return {};
    const programVersion = programs.find(
      (p) => p.id === editingColumn.program_version?.program_id,
    )?.program_version?.[0];
    if (!programVersion) return {};
    const s = getProgramInputSchema(programVersion);
    const fs = s ? buildFieldsFromSchema(s) : [];
    return parseTemplateToFieldValues(
      (editingColumn.input_template as string) ?? "{}",
      fs,
      columns as unknown as Column[],
    );
  };

  const [name, setName] = useState(editingColumn?.name ?? "");
  const [programId, setProgramId] = useState(
    editingColumn?.program_version?.program_id ?? "",
  );
  const [fieldValues, setFieldValues] = useState(initFieldValues);
  const [saving, setSaving] = useState(false);
  const [outputSchemaOpen, setOutputSchemaOpen] = useState(false);
  const [outputSchemaJson, setOutputSchemaJson] = useState(() => {
    const config = getProgramOutputConfig(editingColumn?.program_version);
    if (!config) return "{}";
    return JSON.stringify(config, null, 2);
  });
  const [outputSchemaDirty, setOutputSchemaDirty] = useState(false);
  const [savingOutputSchema, setSavingOutputSchema] = useState(false);

  const initialProgramId = useRef(programId);

  const selectedProgram = programs.find((p) => p.id === programId);
  const latestVersion = selectedProgram?.program_version?.length
    ? selectedProgram.program_version.sort((a, b) => b.version - a.version)[0]
    : null;

  const selectedSchema = getProgramInputSchema(latestVersion);
  const fields = selectedSchema ? buildFieldsFromSchema(selectedSchema) : [];
  const hasManualInput = (() => {
    const config = getProgramOutputConfig(latestVersion) as {
      flags?: {
        allowManualInput?: boolean;
      };
    } | null;
    return config?.flags?.allowManualInput === true;
  })();

  useEffect(() => {
    if (programId === initialProgramId.current) return;
    initialProgramId.current = programId;

    const program = programs.find((p) => p.id === programId);
    if (!program) {
      setFieldValues({});
      return;
    }

    const version = program.program_version?.length
      ? program.program_version.sort((a, b) => b.version - a.version)[0]
      : null;

    const s = getProgramInputSchema(version);
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
    programId,
    programs,
  ]);

  const buildTemplate = (): string => {
    const template: Record<string, unknown> = {};
    for (const [key, fv] of Object.entries(fieldValues)) {
      if (fv.mode === "column") {
        template[`${key}.$`] = `$.columns.${fv.value}.value`;
      } else {
        const field = fields.find((f) => f.key === key);
        if (!field) continue;

        let val = fv.value;
        if (typeof val === "string") {
          val = val.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
            const sortedCols = [
              ...columns,
            ].sort((a, b) => b.name.length - a.name.length);
            const col = sortedCols.find(
              (c) =>
                inner === c.name ||
                inner.startsWith(`${c.name}.`) ||
                inner.startsWith(`${c.name}[`),
            );
            if (col) {
              const restPath = inner.slice(col.name.length);
              return `{{$.columns.${col.id}.value${restPath}}}`;
            }
            return match;
          });
        }

        const coerced = coerceFieldValue(field, val);
        if (coerced !== undefined) template[key] = coerced;
      }
    }
    return JSON.stringify(template);
  };

  const validateTemplate = (): string | null => {
    for (const [_key, fv] of Object.entries(fieldValues)) {
      if (fv.mode === "static" && typeof fv.value === "string") {
        const matches = [
          ...fv.value.matchAll(/\{\{([^}]+)\}\}/g),
        ];
        for (const match of matches) {
          const inner = match[1];
          const sortedCols = [
            ...columns,
          ].sort((a, b) => b.name.length - a.name.length);
          const col = sortedCols.find(
            (c) =>
              inner === c.name ||
              inner.startsWith(`${c.name}.`) ||
              inner.startsWith(`${c.name}[`),
          );
          if (!col) {
            return `Unrecognized column in formula: "${inner}". Please check your spelling.`;
          }
        }
      }
    }
    return null;
  };

  const validationError = validateTemplate();

  const handleSave = async () => {
    if (!name.trim() || !programId || validationError || !latestVersion) return;
    setSaving(true);
    try {
      if (mode.kind === "create") {
        await onCreateColumn({
          input_template: buildTemplate(),
          name: name.trim(),
          program_id: latestVersion.id,
        });
        setName("");
        setProgramId("");
        setFieldValues({});
        onClose();
      } else {
        await onUpdateColumn({
          columnId: mode.columnId,
          input_template: buildTemplate(),
          name: name.trim(),
          program_id: latestVersion.id,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const isCreate = mode.kind === "create";

  return (
    <aside className="flex w-80 shrink-0 flex-col border-zinc-200 border-l bg-zinc-50">
      <div className="flex items-center justify-between border-zinc-200 border-b px-4 py-2.5">
        <h2 className="font-medium text-xs text-zinc-500 uppercase tracking-wider">
          {isCreate ? "New Column" : "Edit Column"}
        </h2>
        <button
          className="text-sm text-zinc-400 leading-none transition-colors hover:text-zinc-700"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        <div className="block">
          <MarbleFieldLabel>Name</MarbleFieldLabel>
          <MarbleInput
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Uppercased"
            type="text"
            value={name}
            wrapperClassName="w-full"
          />
        </div>

        <div className="mt-2 block">
          <MarbleFieldLabel>Program</MarbleFieldLabel>
          <MarbleSelect
            onChange={(e) => setProgramId(e.target.value)}
            value={programId}
            wrapperClassName="w-full"
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
          </MarbleSelect>
        </div>

        {hasManualInput && (
          <div className="rounded border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-orange-600 text-xs">
            This program reads from cell.manualInputValue — cells will be
            editable.
          </div>
        )}

        {fields.length > 0 && (
          <div className="space-y-2">
            <MarbleFieldLabel>Input Template</MarbleFieldLabel>
            {fields.map((f) => {
              const fv = fieldValues[f.key] ?? {
                mode: "static",
                value: "",
              };
              return (
                <div
                  className="space-y-1.5 rounded border border-zinc-200 bg-zinc-100 p-2.5"
                  key={f.key}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-orange-600 text-xs">
                      {f.key}
                    </span>
                    <span className="text-[10px] text-zinc-500">{f.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex cursor-pointer items-center gap-1">
                      <input
                        checked={fv.mode === "static"}
                        className="accent-orange-500"
                        name={`mode-${f.key}`}
                        onChange={() =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.key]: {
                              mode: "static",
                              value: f.defaultValue ?? f.enumValues?.[0] ?? "",
                            },
                          }))
                        }
                        type="radio"
                      />
                      Formula
                    </label>
                    <label className="flex cursor-pointer items-center gap-1">
                      <input
                        checked={fv.mode === "column"}
                        className="accent-orange-500"
                        name={`mode-${f.key}`}
                        onChange={() =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.key]: {
                              mode: "column",
                              value: columns[0]?.id ?? "",
                            },
                          }))
                        }
                        type="radio"
                      />
                      From column
                    </label>
                  </div>
                  {fv.mode === "static" ? (
                    f.enumValues ? (
                      <MarbleSelect
                        onChange={(e) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.key]: {
                              ...fv,
                              value: e.target.value,
                            },
                          }))
                        }
                        size="xs"
                        value={fv.value}
                        wrapperClassName="w-full"
                      >
                        {f.enumValues.map((v) => (
                          <option
                            key={v}
                            value={v}
                          >
                            {v}
                          </option>
                        ))}
                      </MarbleSelect>
                    ) : (
                      <InterpolationEditor
                        columns={columns}
                        onChange={(newVal) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.key]: {
                              ...fv,
                              value: newVal,
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
                        value={fv.value}
                      />
                    )
                  ) : (
                    <MarbleSelect
                      onChange={(e) =>
                        setFieldValues((prev) => ({
                          ...prev,
                          [f.key]: {
                            ...fv,
                            value: e.target.value,
                          },
                        }))
                      }
                      size="xs"
                      value={fv.value}
                      wrapperClassName="w-full"
                    >
                      <option
                        disabled
                        value=""
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
                    </MarbleSelect>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* Output Config escape hatch — edit mode only */}
        {!isCreate && selectedProgram && (
          <div className="border-zinc-200 border-t pt-3">
            <button
              className="flex w-full items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider"
              onClick={() => setOutputSchemaOpen((o) => !o)}
              type="button"
            >
              <span
                className="text-[8px] transition-transform"
                style={{
                  transform: outputSchemaOpen
                    ? "rotate(90deg)"
                    : "rotate(0deg)",
                }}
              >
                ▶
              </span>
              Output Config
              {outputSchemaDirty && (
                <span className="text-orange-500 normal-case tracking-normal">
                  (unsaved)
                </span>
              )}
            </button>
            {outputSchemaOpen && (
              <div className="mt-2 space-y-2">
                <MarbleTextarea
                  monospace
                  onChange={(e) => {
                    setOutputSchemaJson(e.target.value);
                    setOutputSchemaDirty(true);
                  }}
                  rows={8}
                  size="xs"
                  spellCheck={false}
                  value={outputSchemaJson}
                />
                <MarbleButton
                  className="w-full"
                  disabled={!outputSchemaDirty || savingOutputSchema}
                  onClick={async () => {
                    let parsed: unknown;
                    try {
                      parsed = JSON.parse(outputSchemaJson);
                    } catch {
                      return;
                    }
                    setSavingOutputSchema(true);
                    try {
                      await actions.updateProgramOutputSchema(
                        selectedProgram.id,
                        parsed,
                      );
                      setOutputSchemaDirty(false);
                    } finally {
                      setSavingOutputSchema(false);
                    }
                  }}
                >
                  {savingOutputSchema ? "Saving..." : "Save Output Config"}
                </MarbleButton>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 border-zinc-300 border-t bg-zinc-100 p-4">
        {validationError && (
          <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-2.5 py-2 text-red-600 text-xs">
            <span className="mt-0.5">⚠️</span>
            <span>{validationError}</span>
          </div>
        )}
        <MarbleButton
          className="w-full"
          disabled={!name.trim() || !programId || saving || !!validationError}
          onClick={handleSave}
          variant="orange"
        >
          {saving
            ? isCreate
              ? "Creating..."
              : "Saving..."
            : isCreate
              ? "Create Column"
              : "Save Changes"}
        </MarbleButton>
      </div>
    </aside>
  );
}
