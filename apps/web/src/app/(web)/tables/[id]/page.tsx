"use client";

import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { createClient } from "@marble/supabase";
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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Editor from "react-simple-code-editor";
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

function getProgramOutputConfig(
  program: Program | Column["program"] | null | undefined,
): Record<string, unknown> | null {
  if (!program || typeof program !== "object") return null;
  const record = program as Record<string, unknown>;
  const config = record.output_config ?? record.output_value_schema;
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  return config as Record<string, unknown>;
}

function getProgramInputSchema(
  program: Program | Column["program"] | null | undefined,
): Record<string, unknown> | null {
  if (!program || typeof program !== "object") return null;
  const record = program as Record<string, unknown>;
  const schema = record.input_schema ?? record.input_payload_schema;
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    return null;
  return schema as Record<string, unknown>;
}

function isManualInputColumn(column: Column): boolean {
  const config = getProgramOutputConfig(column.program) as {
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
        className="fixed z-[61] bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[160px]"
        style={{
          top: state.y,
          left: state.x,
        }}
      >
        {state.items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 transition-colors ${
              item.danger ? "text-red-600 hover:bg-red-50" : "text-zinc-700"
            }`}
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
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      tabIndex={-1}
    >
      <div
        className="bg-white border border-zinc-200 rounded-lg w-full max-w-sm shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <h3 className="text-sm font-semibold mb-2">{state.title}</h3>
        <p className="text-sm text-zinc-600 mb-5">{state.message}</p>
        <div className="flex items-center justify-end gap-2">
          <DemoButton onClick={onClose}>Cancel</DemoButton>
          <DemoButton
            variant="red"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
          >
            {state.confirmLabel}
          </DemoButton>
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

// ── Custom Column Header ────────────────────────────────

function ColumnHeader(props: IHeaderParams) {
  const ctx = props.context as GridContext;
  const columnId = props.column.getColId();
  const isActive = ctx.activeColumnId === columnId;

  return (
    <button
      type="button"
      className={`flex items-center w-full h-full cursor-pointer select-none transition-colors bg-transparent border-none p-0 text-left text-inherit ${
        isActive ? "text-orange-700 font-semibold" : ""
      }`}
      onClick={() => ctx.onHeaderClick(columnId)}
      onContextMenu={(e) => {
        e.preventDefault();
        ctx.onHeaderContextMenu(columnId, e.clientX, e.clientY);
      }}
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
      type="button"
      className="flex items-center justify-center w-full h-full cursor-pointer bg-transparent border-none p-0 group/add"
      onClick={() => ctx.openCreateColumn()}
    >
      <span className="text-zinc-400 group-hover/add:text-orange-600 transition-colors text-sm font-medium leading-none">
        +
      </span>
    </button>
  );
}

// ── Cell Renderer ───────────────────────────────────────

function CellRunningIndicator() {
  return (
    <div
      className="absolute top-0 bottom-0 overflow-hidden bg-zinc-100/80 shadow-[inset_0_0_8px_rgba(0,0,0,0.05)] z-0 pointer-events-none"
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

      <div className="absolute inset-0 bg-gradient-to-r from-zinc-200/0 via-zinc-200/80 to-zinc-200/0 animate-pulse" />

      <div className="absolute inset-0 overflow-hidden mix-blend-overlay opacity-20">
        <div
          className="w-full h-[200%]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "4px 4px",
            animation: "motlo-climb 0.8s linear infinite",
          }}
        />
      </div>

      <div
        className="absolute top-[-50%] bottom-[-50%] w-16 flex"
        style={{
          animation: "motlo-swathe 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          transformOrigin: "center",
        }}
      >
        <div className="w-full h-full bg-gradient-to-r from-transparent via-orange-400/30 to-orange-500/80 blur-[2px] skew-x-[-20deg]" />
        <div className="w-[2px] h-full bg-orange-500 shadow-[0_0_12px_3px_rgba(249,115,22,0.9)] skew-x-[-20deg] translate-x-[-2px]" />
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
    <div className="group/cell flex items-center w-full h-full relative">
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

// ── UI Components ───────────────────────────────────────

type DemoButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "light" | "dark" | "orange" | "red";
};

function DemoButton({
  variant = "light",
  children,
  className,
  disabled,
  ...props
}: DemoButtonProps) {
  const isOrange = variant === "orange";
  const isRed = variant === "red";
  const isDark = variant === "dark";
  const isLight = variant === "light";

  return (
    <button
      type="button"
      className={`bg-neutral-950 p-0.5 rounded-[7px] transition-opacity ${disabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-90 cursor-pointer"} ${className || ""}`}
      disabled={disabled}
      {...props}
    >
      <div
        className={`size-full p-[1px] rounded-md ${isOrange ? "bg-orange-600" : isRed ? "bg-red-600" : isLight ? "bg-neutral-200" : ""}`}
        style={{
          background: isOrange
            ? `linear-gradient(to right, var(--color-orange-300) 0px, #F6490000 4px),
              linear-gradient(to left, var(--color-orange-800) 0px, #F6490000 4px),
              linear-gradient(to top, var(--color-orange-950) 0px, #F6490000 4px),
              linear-gradient(to bottom, var(--color-orange-300) 0px, #F6490000 4px),
              linear-gradient(to bottom right, var(--color-white) 0px, #F6490000 4px), linear-gradient(to right, var(--color-orange-600) 0%, var(--color-orange-600) 100%)`
            : isRed
              ? `linear-gradient(to right, var(--color-red-300) 0px, #DC262600 4px),
              linear-gradient(to left, var(--color-red-800) 0px, #DC262600 4px),
              linear-gradient(to top, var(--color-red-950) 0px, #DC262600 4px),
              linear-gradient(to bottom, var(--color-red-300) 0px, #DC262600 4px),
              linear-gradient(to bottom right, var(--color-white) 0px, #DC262600 4px), linear-gradient(to right, var(--color-red-600) 0%, var(--color-red-600) 100%)`
              : isDark
                ? `linear-gradient(to right, var(--color-neutral-300) 0px, #40404000 4px),
              linear-gradient(to left, var(--color-neutral-800) 0px, #40404000 4px),
              linear-gradient(to top, var(--color-neutral-950) 0px, #40404000 4px),
              linear-gradient(to bottom, var(--color-neutral-100) 0px, #40404000 4px),
              linear-gradient(to bottom right, var(--color-white) 0px, #40404000 4px)`
                : `linear-gradient(to right, var(--color-neutral-100) 0px, #e5e5e500 4px),
              linear-gradient(to left, var(--color-neutral-400) 0px, #e5e5e500 4px),
              linear-gradient(to top, var(--color-neutral-200) 0px, #e5e5e500 4px),
              linear-gradient(to bottom, var(--color-neutral-300) 0px, #e5e5e500 4px),
              linear-gradient(to bottom right, var(--color-white) 0px, #e5e5e500 4px)`,
        }}
      >
        <div
          className={`size-full flex items-center justify-center font-medium uppercase py-1.5 px-3 rounded-[5px] tracking-wide text-xs ${
            isOrange
              ? "bg-orange-600 text-white"
              : isRed
                ? "bg-red-600 text-white"
                : isDark
                  ? "bg-neutral-800 text-neutral-100 font-light"
                  : "bg-neutral-50 text-neutral-700 shadow-sm font-medium"
          }`}
        >
          {children}
        </div>
      </div>
    </button>
  );
}

type DemoSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
};

function DemoSelect({
  className,
  wrapperClassName,
  children,
  ...props
}: DemoSelectProps) {
  return (
    <div className={`relative inline-flex ${wrapperClassName || ""}`}>
      <select
        className={`w-full bg-white border-b-2 border-x border-t border-neutral-200 border-b-neutral-300 text-neutral-900 text-sm rounded-md pl-3 pr-8 py-1.5 focus:border-b-orange-400 focus:outline-none appearance-none cursor-pointer transition-colors shadow-sm ${className || ""}`}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
        <svg
          className="fill-current h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  );
}

type DemoInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
};

function DemoInput({ className, wrapperClassName, ...props }: DemoInputProps) {
  return (
    <div className={`relative flex ${wrapperClassName || ""}`}>
      <input
        className={`w-full bg-white border-b-2 border-x border-t border-neutral-200 border-b-neutral-300 text-neutral-900 text-sm rounded-md px-3 py-1.5 focus:border-b-orange-400 focus:outline-none placeholder-neutral-400 transition-colors shadow-sm ${className || ""}`}
        {...props}
      />
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
        ref={inputRef}
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setTempValue(value);
            setEditing(false);
          }
        }}
        className="bg-transparent border-b border-orange-500 outline-none px-1 text-sm font-medium w-48 focus:border-b-2 transition-all text-neutral-900 placeholder-neutral-400"
        placeholder="Table Name"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 px-1.5 py-0.5 rounded transition-colors cursor-text text-left max-w-[200px] truncate"
      title="Click to edit"
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
        pattern: /\{\{[^}]+\}\}/,
        inside: {
          "tag-open": {
            pattern: /^\{\{/,
            alias: "punctuation",
          },
          "tag-close": {
            pattern: /\}\}$/,
            alias: "punctuation",
          },
          "col-name": {
            // Match the column name component (which may include spaces)
            // It stops at the first unescaped dot, square bracket, or the opening/closing braces.
            pattern: /^([^{}.[\]]+)/,
            alias: "keyword",
          },
          "col-path": {
            // Match the property path dot-notation or array indexing
            pattern: /^[.[][^\s}]+/,
            alias: "property",
          },
          "invalid-text": {
            pattern: /[^}]+/,
            alias: "invalid",
          },
        },
      },
    };
  }, []);

  return (
    <div className="relative border border-zinc-300 rounded bg-white overflow-hidden focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-all text-xs">
      <Editor
        value={value}
        onValueChange={onChange}
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
        padding={8}
        placeholder={placeholder}
        className="font-mono min-h-[40px]"
        textareaClassName="focus:outline-none"
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
        }}
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

    const pendingUpdates = new Map<string, Cell>();
    const pendingInserts = new Map<string, Cell>();
    const pendingDeletes = new Set<string>();

    let flushTimeout: NodeJS.Timeout | null = null;

    const flush = () => {
      if (
        pendingInserts.size === 0 &&
        pendingUpdates.size === 0 &&
        pendingDeletes.size === 0
      )
        return;

      setCells((prev) => {
        const next = [
          ...prev,
        ];
        let changed = false;

        if (pendingDeletes.size > 0) {
          const originalLength = next.length;
          const filtered = next.filter((c) => !pendingDeletes.has(c.id));
          if (filtered.length !== originalLength) {
            next.length = 0;
            next.push(...filtered);
            changed = true;
          }
        }

        if (pendingUpdates.size > 0) {
          for (let i = 0; i < next.length; i++) {
            const u = pendingUpdates.get(next[i].id);
            if (u) {
              next[i] = u;
              changed = true;
            }
          }
        }

        if (pendingInserts.size > 0) {
          const existingIds = new Set(next.map((c) => c.id));
          for (const ins of pendingInserts.values()) {
            if (!existingIds.has(ins.id)) {
              next.push(ins);
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
            pendingUpdates.set(updated.id, updated);
          } else if (payload.eventType === "INSERT") {
            const inserted = payload.new as Cell;
            if (!columnIds.has(inserted.column_id)) return;
            pendingInserts.set(inserted.id, inserted);
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as {
              id: string;
            };
            pendingDeletes.add(deleted.id);
          }

          if (!flushTimeout) {
            flushTimeout = setTimeout(() => {
              flushTimeout = null;
              flush();
            }, 100);
          }
        },
      )
      .subscribe();

    return () => {
      if (flushTimeout) clearTimeout(flushTimeout);
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
          headerComponent: ColumnHeader,
          headerTooltip: col.program?.name,
          field: col.id,
          editable,
          sortable: false,
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
        } satisfies ColDef;
      }),
      {
        headerName: "",
        headerComponent: AddColumnButton,
        width: 44,
        sortable: false,
        suppressMovable: true,
        resizable: false,
        cellRenderer: () => null,
      },
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
        title: "Delete Column",
        message: `Delete "${col?.name ?? "this column"}"? All cells in this column will be permanently removed.`,
        confirmLabel: "Delete",
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
      });
    },
    [
      handleDeleteColumn,
    ],
  );

  const requestDeleteRow = useCallback(
    (rowId: string, rowIndex: number) => {
      setConfirmState({
        title: "Delete Row",
        message: `Delete Row ${rowIndex + 1}? All cells in this row will be permanently removed.`,
        confirmLabel: "Delete",
        onConfirm: () => handleDeleteRow(rowId),
      });
    },
    [
      handleDeleteRow,
    ],
  );

  const handleHeaderClick = useCallback((columnId: string) => {
    setSidebarMode({
      kind: "edit",
      columnId,
    });
  }, []);

  const handleHeaderContextMenu = useCallback(
    (columnId: string, x: number, y: number) => {
      setContextMenu({
        x,
        y,
        items: [
          {
            label: "Edit Column",
            onClick: () =>
              setSidebarMode({
                kind: "edit",
                columnId,
              }),
          },
          {
            label: "Delete Column",
            onClick: () => requestDeleteColumn(columnId),
            danger: true,
          },
        ],
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
        x: browserEvent.clientX,
        y: browserEvent.clientY,
        items: [
          {
            label: `Delete Row ${rowIndex + 1}`,
            onClick: () => requestDeleteRow(rowId, rowIndex),
            danger: true,
          },
        ],
      });
    },
    [
      requestDeleteRow,
    ],
  );

  // ── Grid context ──────────────────────────────────────

  const gridContext = useMemo<GridContext>(
    () => ({
      runCell,
      onHeaderClick: handleHeaderClick,
      onHeaderContextMenu: handleHeaderContextMenu,
      openCreateColumn: () =>
        setSidebarMode({
          kind: "create",
        }),
      activeColumnId: sidebarMode.kind === "edit" ? sidebarMode.columnId : null,
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
          <Link
            href="/tables"
            className="hover:text-orange-600 transition-colors"
          >
            marble
          </Link>
        </h1>

        <div className="h-4 w-px bg-zinc-300 mx-2" />

        {selectedTableId && (
          <div className="flex items-center gap-2">
            <Link
              href="/tables"
              className="text-zinc-400 hover:text-zinc-900 transition-colors bg-zinc-100 hover:bg-zinc-200 rounded p-1"
              title="Back to tables"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
            </Link>
            <ClickToEditTitle
              value={
                tables.find((t) => t.id === selectedTableId)?.name ||
                "Untitled Table"
              }
              onChange={handleRenameTable}
            />
          </div>
        )}

        {running && (
          <span className="text-orange-400 text-xs font-mono animate-pulse ml-4">
            running...
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <SignOutButton />
        </div>
      </header>

      <div className="flex justify-between items-center px-5 py-1.5 border-b border-zinc-200 bg-white">
        <div></div>
        <DemoButton
          variant="orange"
          onClick={handleRunAll}
          disabled={!selectedTableId || columns.length === 0 || running}
        >
          Run All
        </DemoButton>
      </div>

      {/* Main */}
      <div className="flex-1 flex min-h-0">
        {/* Grid + log panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-4 flex flex-col h-full">
            {selectedTableId ? (
              <div className="flex-1 min-h-0 mb-4">
                <AgGridReact
                  ref={gridRef}
                  theme={gridTheme}
                  columnDefs={colDefs}
                  rowData={rowData}
                  context={gridContext}
                  onCellValueChanged={onCellValueChanged}
                  preventDefaultOnContextMenu
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
                      rowIndex: event.data?._rowIndex as number,
                      state: getCellState(cell),
                      manualInput: cell?.manual_input ?? null,
                    });
                  }}
                  domLayout="normal"
                  headerHeight={34}
                  rowHeight={32}
                  getRowId={(params) => params.data._rowId as string}
                />
              </div>
            ) : (
              <div className="text-zinc-500 text-sm flex items-center justify-center flex-1">
                Select or create a table to get started.
              </div>
            )}

            <div className="flex justify-start shrink-0 mt-2">
              <div className="flex items-center gap-2">
                <DemoButton
                  onClick={handleAddRows}
                  disabled={!selectedTableId}
                >
                  Add
                </DemoButton>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={rowCount}
                  onChange={(e) =>
                    setRowCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className="w-16 bg-white border border-zinc-200 text-zinc-900 text-sm rounded-md px-2 py-1 focus:border-orange-400 focus:outline-none transition-colors shadow-sm"
                />
                <span className="text-sm text-zinc-600">
                  {rowCount === 1 ? "Row" : "Rows"}
                </span>
              </div>
            </div>
          </div>

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

        {/* Column sidebar — only visible when creating or editing */}
        {sidebarMode.kind !== "closed" && (
          <ColumnSidebar
            key={
              sidebarMode.kind === "edit"
                ? `edit-${sidebarMode.columnId}`
                : "create"
            }
            mode={sidebarMode}
            columns={sortedColumns}
            programs={programs}
            onCreateColumn={handleCreateColumn}
            onUpdateColumn={handleUpdateColumn}
            onClose={() =>
              setSidebarMode({
                kind: "closed",
              })
            }
          />
        )}
      </div>

      {/* Overlays */}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
      {confirmState && (
        <ConfirmModal
          state={confirmState}
          onClose={() => setConfirmState(null)}
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
    const program = programs.find((p) => p.id === editingColumn.program_id);
    if (!program) return {};
    const s = getProgramInputSchema(program);
    const fs = s ? buildFieldsFromSchema(s) : [];
    return parseTemplateToFieldValues(
      (editingColumn.input_template as string) ?? "{}",
      fs,
      columns,
    );
  };

  const [name, setName] = useState(editingColumn?.name ?? "");
  const [programId, setProgramId] = useState(editingColumn?.program_id ?? "");
  const [fieldValues, setFieldValues] = useState(initFieldValues);
  const [saving, setSaving] = useState(false);
  const [outputSchemaOpen, setOutputSchemaOpen] = useState(false);
  const [outputSchemaJson, setOutputSchemaJson] = useState(() => {
    const config = getProgramOutputConfig(editingColumn?.program);
    if (!config) return "{}";
    return JSON.stringify(config, null, 2);
  });
  const [outputSchemaDirty, setOutputSchemaDirty] = useState(false);
  const [savingOutputSchema, setSavingOutputSchema] = useState(false);

  const initialProgramId = useRef(programId);

  const selectedProgram = programs.find((p) => p.id === programId);
  const selectedSchema = getProgramInputSchema(selectedProgram);
  const fields = selectedSchema ? buildFieldsFromSchema(selectedSchema) : [];
  const hasManualInput = (() => {
    const config = getProgramOutputConfig(selectedProgram) as {
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

    const s = getProgramInputSchema(program);
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
    if (!name.trim() || !programId || validationError) return;
    setSaving(true);
    try {
      if (mode.kind === "create") {
        await onCreateColumn({
          name: name.trim(),
          program_id: programId,
          input_template: buildTemplate(),
        });
        setName("");
        setProgramId("");
        setFieldValues({});
        onClose();
      } else {
        await onUpdateColumn({
          columnId: mode.columnId,
          name: name.trim(),
          program_id: programId,
          input_template: buildTemplate(),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const isCreate = mode.kind === "create";

  return (
    <aside className="w-80 border-l border-zinc-200 flex flex-col bg-zinc-50 shrink-0">
      <div className="px-4 py-2.5 border-b border-zinc-200 flex items-center justify-between">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {isCreate ? "New Column" : "Edit Column"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-700 transition-colors text-sm leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="block">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">
            Name
          </span>
          <DemoInput
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Uppercased"
            wrapperClassName="w-full"
          />
        </div>

        <div className="block mt-2">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">
            Program
          </span>
          <DemoSelect
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
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
          </DemoSelect>
        </div>

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
                      Formula
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
                      <InterpolationEditor
                        value={fv.value}
                        onChange={(newVal) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.key]: {
                              ...fv,
                              value: newVal,
                            },
                          }))
                        }
                        columns={columns}
                        placeholder={
                          f.type === "object"
                            ? f.required
                              ? '{"key": "value"}'
                              : "leave blank or JSON"
                            : f.type === "array"
                              ? "[]"
                              : undefined
                        }
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
        {/* Output Config escape hatch — edit mode only */}
        {!isCreate && selectedProgram && (
          <div className="border-t border-zinc-200 pt-3">
            <button
              type="button"
              onClick={() => setOutputSchemaOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider w-full"
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
                <textarea
                  value={outputSchemaJson}
                  onChange={(e) => {
                    setOutputSchemaJson(e.target.value);
                    setOutputSchemaDirty(true);
                  }}
                  spellCheck={false}
                  rows={8}
                  className="w-full bg-white border border-zinc-300 rounded px-2 py-1.5 text-xs font-mono focus:border-orange-600 focus:outline-none resize-y"
                />
                <DemoButton
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
                </DemoButton>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-300 bg-zinc-100 p-4 space-y-3">
        {validationError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2.5 py-2 flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <span>{validationError}</span>
          </div>
        )}
        <DemoButton
          variant="orange"
          className="w-full"
          onClick={handleSave}
          disabled={!name.trim() || !programId || saving || !!validationError}
        >
          {saving
            ? isCreate
              ? "Creating..."
              : "Saving..."
            : isCreate
              ? "Create Column"
              : "Save Changes"}
        </DemoButton>
      </div>
    </aside>
  );
}
