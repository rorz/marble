"use client";

import { toCamelKeys } from "@marble/lib/object";
import type { MarbleClient } from "@marble/sdk";
import {
  cx,
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleEditableText,
  MarbleFieldLabel,
  MarbleInput,
  MarbleModal,
  MarbleModalContent,
  MarbleModalFooter,
  MarbleModalHeader,
  MarbleModalTitle,
  MarblePane,
  MarblePaneEditableCrumb,
  MarbleSelect,
  MarbleSheet,
  MarbleSheetClose,
  MarbleSheetContent,
  MarbleSheetDescription,
  MarbleSheetFooter,
  MarbleSheetHeader,
  MarbleSheetTitle,
  MarbleTextarea,
} from "@marble/ui";
import { PlayIcon } from "@phosphor-icons/react/ssr";
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
import { useRouter } from "next/navigation";
import Prism from "prismjs";
import type React from "react";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Editor from "react-simple-code-editor";
import { useMarbleSdk, useMarbleWebSessionSdk } from "@/lib/marble-sdk-client";
import {
  createBroadcastMutationGuard,
  type DeleteMutation,
  type UpsertMutation,
} from "@/lib/realtime/broadcast-mutations";
import { usePrivateBroadcast } from "@/lib/realtime/private-broadcast";
import {
  type ChangeTargetDescriptor,
  changeTargetKey,
  getChangeTargetProps,
  useChangeSpotlightResolver,
} from "../../change-spotlight";
import { type TablePageData, updateProgramOutputSchema } from "./actions";

ModuleRegistry.registerModules([
  AllCommunityModule,
]);

// ── Types ───────────────────────────────────────────────

type InitialTablePageData = TablePageData;
type Program = InitialTablePageData["programs"][number];
type TableInfo = InitialTablePageData["table"];
type ReferenceableColumn = InitialTablePageData["referenceColumns"][number];
type Column = InitialTablePageData["columns"][number];
type ColumnRecord = Omit<Column, "programVersion">;
type Row = InitialTablePageData["rows"][number];
type Cell = InitialTablePageData["cells"][number];
type SecretRecord = InitialTablePageData["secrets"][number];
type ProgramSecretBindingMap = InitialTablePageData["programSecretBindings"];
type ColumnSecretBindingMap = InitialTablePageData["columnSecretBindings"];
type ProgramSecretDeclarationsByProgramId =
  InitialTablePageData["programSecretDeclarations"];
type BroadcastRecord = Record<string, unknown>;
type SecretBindingInput = {
  envName: string;
  secretId: string;
};
type RunExecutionResult = {
  output: unknown;
  runId: string;
  success: boolean;
};
type TableMutation =
  | DeleteMutation<"cell:delete", BroadcastRecord>
  | UpsertMutation<"cell:upsert", BroadcastRecord>
  | DeleteMutation<"column:delete", BroadcastRecord>
  | UpsertMutation<"column:upsert", BroadcastRecord>
  | DeleteMutation<"row:delete", BroadcastRecord>
  | UpsertMutation<"row:upsert", BroadcastRecord>
  | DeleteMutation<"table:delete", BroadcastRecord>
  | UpsertMutation<"table:upsert", BroadcastRecord>;
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

const tableMutationTypes = {
  "cell:delete": true,
  "cell:upsert": true,
  "column:delete": true,
  "column:upsert": true,
  "row:delete": true,
  "row:upsert": true,
  "table:delete": true,
  "table:upsert": true,
} satisfies Record<TableMutation["type"], true>;

const isTableMutation =
  createBroadcastMutationGuard<TableMutation>(tableMutationTypes);

function deleteColumn(sdk: MarbleClient, columnId: string) {
  return sdk.columns.delete({
    id: columnId,
  });
}

function deleteRow(sdk: MarbleClient, rowId: string) {
  return sdk.rows.delete({
    id: rowId,
  });
}

function executeRun(
  sdk: MarbleClient,
  input: {
    cellId: string;
    cellValue?: string;
  },
): Promise<RunExecutionResult> {
  return sdk.cells.run({
    id: input.cellId,
    ...(input.cellValue === undefined
      ? {}
      : {
          manualInput: input.cellValue,
        }),
  });
}

function findProgramVersionForColumn(
  programs: Program[],
  programVersionId: string,
): Column["programVersion"] | null {
  for (const program of programs) {
    for (const version of program.programVersions ?? []) {
      if (version.id === programVersionId) {
        return {
          ...version,
          program,
        };
      }
    }
  }

  return null;
}

function hydrateColumnRecord(
  column: ColumnRecord,
  programs: Program[],
): Column {
  return {
    ...column,
    programVersion: findProgramVersionForColumn(
      programs,
      column.programVersionId,
    ),
  };
}

function createColumn(
  sdk: MarbleClient,
  input: {
    inputTemplate: string;
    name: string;
    programVersionId: string;
    runCondition: boolean;
    tableId: string;
  },
) {
  return sdk.columns.create({
    inputTemplate: input.inputTemplate,
    name: input.name,
    programVersionId: input.programVersionId,
    runCondition: input.runCondition,
    tableId: input.tableId,
  });
}

function updateColumn(
  sdk: MarbleClient,
  input: {
    columnId: string;
    inputTemplate?: string;
    name?: string;
    programVersionId?: string;
    runCondition?: boolean;
  },
) {
  return sdk.columns.update({
    id: input.columnId,
    values: {
      ...(input.inputTemplate === undefined
        ? {}
        : {
            inputTemplate: input.inputTemplate,
          }),
      ...(input.name === undefined
        ? {}
        : {
            name: input.name,
          }),
      ...(input.programVersionId === undefined
        ? {}
        : {
            programVersionId: input.programVersionId,
          }),
      ...(input.runCondition === undefined
        ? {}
        : {
            runCondition: input.runCondition,
          }),
    },
  });
}

function updateColumnSecretBindings(
  sdk: MarbleClient,
  columnId: string,
  bindings: SecretBindingInput[],
) {
  return sdk.secretBindings.setColumn({
    bindings,
    columnId,
  });
}

type GridContext = {
  runCell: (columnId: string, rowId: string) => void;
  onHeaderClick: (columnId: string) => void;
  onHeaderContextMenu: (columnId: string, x: number, y: number) => void;
  openCreateColumn: () => void;
  activeColumnId: string | null;
};

const TABLE_CELL_HORIZONTAL_PADDING_PX = 4;
const TABLE_CELL_LED_CLEARANCE_PX = 12;
const TABLE_CELL_LED_GUTTER_PX =
  TABLE_CELL_LED_CLEARANCE_PX + TABLE_CELL_HORIZONTAL_PADDING_PX - 2;

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

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// ── Helpers ─────────────────────────────────────────────

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

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

function isTerminalCellState(state: CellState) {
  return state?.ok === true || state?.ok === false;
}

function displayCellValue(cell: Cell | undefined): string {
  const state = getCellState(cell);
  if (!state) return cell?.manualInput ?? "";
  if (state.ok === null) return "⏳";
  if (state.ok === true) {
    const v = state.value;
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    return JSON.stringify(v);
  }
  if (state.ok === false) return `⚠ ${state.message}`;
  return cell?.manualInput ?? "";
}

function describeRunOutput(output: unknown) {
  if (!output || typeof output !== "object") {
    return JSON.stringify(output);
  }

  const record = output as {
    message?: unknown;
    value?: unknown;
  };

  if (typeof record.message === "string") {
    return record.message;
  }

  return JSON.stringify(record.value ?? output);
}

function getProgramOutputConfig(
  programVersion: unknown,
): Record<string, unknown> | null {
  if (!programVersion || typeof programVersion !== "object") return null;
  const record = programVersion as Record<string, unknown>;
  const config = record.outputConfig;
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  return config as Record<string, unknown>;
}

function getProgramInputSchema(
  programVersion: unknown,
): Record<string, unknown> | null {
  if (!programVersion || typeof programVersion !== "object") return null;
  const record = programVersion as Record<string, unknown>;
  const schema = record.inputSchema;
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    return null;
  return schema as Record<string, unknown>;
}

function isManualInputColumn(column: Column): boolean {
  const config = getProgramOutputConfig(column.programVersion) as {
    flags?: {
      allowManualInput?: boolean;
    };
  } | null;
  return config?.flags?.allowManualInput === true;
}

function normalizeBroadcastCell(row: BroadcastRecord): Cell {
  return toCamelKeys(row) as Cell;
}

function normalizeBroadcastColumn(
  row: BroadcastRecord,
  programs: Program[],
): Column {
  return hydrateColumnRecord(toCamelKeys(row) as ColumnRecord, programs);
}

function normalizeBroadcastRow(row: BroadcastRecord): Row {
  return toCamelKeys(row) as Row;
}

function normalizeBroadcastTablePatch(
  row: BroadcastRecord,
): Partial<TableInfo> & {
  id: string;
} {
  return toCamelKeys(row) as Partial<TableInfo> & {
    id: string;
  };
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

function secretBindingEntriesToMap(bindings: SecretBindingInput[]) {
  return Object.fromEntries(
    bindings.map((binding) => [
      binding.envName,
      binding.secretId,
    ]),
  ) as Record<string, string>;
}

function secretBindingMapToEntries(bindings: Record<string, string>) {
  return Object.entries(bindings)
    .sort(([leftEnvName], [rightEnvName]) =>
      leftEnvName.localeCompare(rightEnvName),
    )
    .map(([envName, secretId]) => ({
      envName,
      secretId,
    })) satisfies SecretBindingInput[];
}

function describeColumnSecretResolution(
  declaration: ProgramSecretDeclarationsByProgramId[string][number],
  options: {
    overrideSecretId?: string;
    programDefaultSecretId?: string;
    secrets: SecretRecord[];
  },
) {
  const overrideSecret =
    options.overrideSecretId === undefined
      ? null
      : (options.secrets.find(
          (secret) => secret.id === options.overrideSecretId,
        ) ?? null);
  const programDefaultSecret =
    options.programDefaultSecretId === undefined
      ? null
      : (options.secrets.find(
          (secret) => secret.id === options.programDefaultSecretId,
        ) ?? null);
  const implicitSecret =
    options.secrets.find((secret) => secret.name === declaration.env) ?? null;

  if (options.overrideSecretId !== undefined && overrideSecret === null) {
    return {
      badgeLabel: "Missing",
      badgeTone: "warning" as const,
      helperText: "This override points at a secret that no longer exists.",
      inheritedLabel: "No inherited secret available",
    };
  }

  if (overrideSecret) {
    return {
      badgeLabel: "Override",
      badgeTone: "info" as const,
      helperText: `Overrides the default with ${overrideSecret.name}.`,
      inheritedLabel: "Use inherited default",
    };
  }

  if (
    options.programDefaultSecretId !== undefined &&
    programDefaultSecret === null
  ) {
    return {
      badgeLabel: "Missing",
      badgeTone: "warning" as const,
      helperText: "The inherited program default no longer exists.",
      inheritedLabel: "Program default is missing",
    };
  }

  if (programDefaultSecret) {
    return {
      badgeLabel: "Program",
      badgeTone: "neutral" as const,
      helperText: `Inherits the program default ${programDefaultSecret.name}.`,
      inheritedLabel: `Use program default (${programDefaultSecret.name})`,
    };
  }

  if (implicitSecret) {
    return {
      badgeLabel: "Auto",
      badgeTone: "success" as const,
      helperText: `Falls back to matching secret ${implicitSecret.name}.`,
      inheritedLabel: `Use matching secret (${implicitSecret.name})`,
    };
  }

  return {
    badgeLabel: declaration.required ? "Missing" : "Optional",
    badgeTone: declaration.required
      ? ("warning" as const)
      : ("neutral" as const),
    helperText: declaration.required
      ? "Required before this column can run."
      : "Optional secret.",
    inheritedLabel: "No inherited secret available",
  };
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

function resolveReferenceColumnToken(
  token: string,
  referenceColumns: ReferenceableColumn[],
  currentTableId?: string,
) {
  const sortedColumns = [
    ...referenceColumns,
  ].sort(
    (left, right) =>
      right.label.length - left.label.length ||
      right.name.length - left.name.length,
  );

  for (const column of sortedColumns) {
    const aliases = [
      column.label,
      ...(column.tableId === currentTableId
        ? [
            column.name,
          ]
        : []),
    ];

    for (const alias of aliases) {
      if (
        token === alias ||
        token.startsWith(`${alias}.`) ||
        token.startsWith(`${alias}[`)
      ) {
        return {
          column,
          restPath: token.slice(alias.length),
        };
      }
    }
  }

  return null;
}

function parseTemplateToFieldValues(
  templateJson: string,
  fields: SchemaField[],
  referenceColumns: ReferenceableColumn[],
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
          const col = referenceColumns.find((candidate) => candidate.id === id);
          if (col) return `{{${col.label}${restPath}}}`;
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
    <MarbleModal
      ariaLabel={state.title}
      onClose={onClose}
      size="sm"
    >
      <MarbleModalContent className="space-y-2 pb-5 pt-5">
        <MarbleModalTitle>{state.title}</MarbleModalTitle>
        <p className="text-sm text-zinc-600">{state.message}</p>
      </MarbleModalContent>
      <MarbleModalFooter className="border-t-0 pt-0">
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
      </MarbleModalFooter>
    </MarbleModal>
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

function EditableName({
  className,
  disabled,
  editing,
  name,
  onCancel,
  onChange,
  onCommit,
  onEdit,
}: {
  className: string;
  disabled: boolean;
  editing: boolean;
  name: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  onEdit: () => void;
}) {
  return (
    <MarbleEditableText
      className={className}
      disabled={disabled}
      editing={editing}
      onCancel={onCancel}
      onChange={onChange}
      onCommit={onCommit}
      onEdit={onEdit}
      value={name}
    />
  );
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
    <MarbleModal
      ariaLabel={`${cell.columnName} row ${cell.rowIndex}`}
      onClose={onClose}
      panelClassName="flex max-h-[80vh] flex-col"
    >
      <MarbleModalHeader>
        <div>
          <MarbleModalTitle>
            {cell.columnName}
            <span className="ml-2 font-normal text-zinc-400">
              Row {cell.rowIndex}
            </span>
          </MarbleModalTitle>
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
          className="text-lg leading-none text-zinc-400 hover:text-zinc-700"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </MarbleModalHeader>
      <MarbleModalContent className="flex-1 overflow-auto">
        <div className="space-y-4">
          {cell.manualInput !== null && (
            <div className="mb-4">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                Manual Input
              </div>
              <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm">
                {cell.manualInput || (
                  <span className="text-zinc-300">empty</span>
                )}
              </div>
            </div>
          )}

          <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
            Cell State
          </div>
          {state === null ? (
            <div className="text-sm italic text-zinc-400">
              No state — cell has not been run yet.
            </div>
          ) : (
            <pre className="overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-xs leading-relaxed">
              {tokens}
            </pre>
          )}
        </div>
      </MarbleModalContent>
    </MarbleModal>
  );
}

function getRunLogLineClassName(line: string) {
  if (line.includes("✗")) {
    return "text-red-400";
  }

  if (line.includes("✓")) {
    return "text-green-600";
  }

  if (line.includes("skip")) {
    return "text-blue-500";
  }

  return "text-zinc-500";
}

function RunLogSheet({
  lines,
  onClear,
  onOpenChange,
  open,
}: {
  lines: string[];
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <MarbleSheet
      modal={false}
      onOpenChange={onOpenChange}
      open={open}
    >
      <MarbleSheetContent
        className="border-x-0 border-b-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        showBackdrop={false}
        side="bottom"
      >
        <MarbleSheetHeader className="relative pr-14">
          <MarbleSheetTitle>Run Log</MarbleSheetTitle>
          <MarbleSheetDescription>
            Recent execution output for this table.
          </MarbleSheetDescription>
          <MarbleSheetClose className="absolute top-3 right-3" />
        </MarbleSheetHeader>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {lines.length > 0 ? (
            <pre className="space-y-0.5 font-mono text-xs">
              {lines.map((line, index) => (
                <div
                  className={getRunLogLineClassName(line)}
                  // biome-ignore lint/suspicious/noArrayIndexKey: log
                  key={`${index}-${line.slice(0, 20)}`}
                >
                  {line}
                </div>
              ))}
            </pre>
          ) : (
            <p className="text-sm text-zinc-500">no logs</p>
          )}
        </div>

        <MarbleSheetFooter>
          <MarbleButton onClick={onClear}>Clear</MarbleButton>
          <MarbleSheetClose className="h-auto w-auto rounded-xs border border-taupe-200 px-3 py-1.5 text-sm text-taupe-700">
            Close
          </MarbleSheetClose>
        </MarbleSheetFooter>
      </MarbleSheetContent>
    </MarbleSheet>
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
      {...getChangeTargetProps(changeTargetKey.column(columnId))}
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

function RowNumberCell(props: CustomCellRendererProps) {
  const rowId = props.data?._rowId as string | undefined;

  return (
    <div
      className="flex h-full items-center"
      {...(rowId ? getChangeTargetProps(changeTargetKey.row(rowId)) : {})}
    >
      {props.valueFormatted ?? props.value}
    </div>
  );
}

function CellRunningIndicator() {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-0 overflow-hidden bg-zinc-100/80 shadow-[inset_0_0_8px_rgba(0,0,0,0.05)]"
      style={{
        left: "calc(var(--marble-table-cell-padding-inline, 0px) * -1)",
        right: "calc(var(--marble-table-cell-padding-inline, 0px) * -1)",
      }}
    >
      <style>{`
        @keyframes motlo-breathe {
          0%, 100% { opacity: 0.18; }
          50% { opacity: 0.24; }
        }
      `}</style>

      <div
        className="absolute inset-0"
        style={{
          animation: "motlo-breathe 5.6s ease-in-out infinite",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.2) 48%, rgba(255,255,255,0.1) 100%)",
        }}
      />

      <div
        className="absolute inset-0 overflow-hidden opacity-[0.07] mix-blend-overlay"
        style={{
          animation: "motlo-breathe 6.8s ease-in-out infinite",
        }}
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "6px 6px",
          }}
        />
      </div>

      <div className="absolute inset-x-0 top-0 h-px bg-white/55" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-200/65" />
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
    <div
      className="group/cell relative flex h-full w-full items-center"
      {...(columnId && rowId
        ? getChangeTargetProps(changeTargetKey.cell(rowId, columnId))
        : {})}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center bg-taupe-50"
        style={{
          // background: "var(--marble-table-cell-background, #fafafa)",
          left: "calc(var(--marble-table-cell-padding-inline, 0px) * -1)",
          width: "var(--marble-table-cell-led-gutter-width, 0px)",
        }}
      >
        <div className="flex w-full h-full flex-col items-center justify-evenly gap-[3px]">
          <span
            className={cx(
              "block size-1 rounded-[1px] bg-amber-200/20 transition-all",
              isLoading &&
                "animate-blink duration-75 bg-amber-400 shadow-[0_0_2px_rgba(251,146,60,0.55)]",
            )}
          />
          <span
            className={cx(
              "block size-1 rounded-[1px] bg-zinc-300/20 transition-all",
              state?.ok === true &&
                "bg-green-300 shadow-[0_0_2px_oklch(89.7%_0.196_126.665)]",
              isFailed && "bg-red-400 shadow-[0_0_2px_rgba(239,68,68,0.55)]",
            )}
          />
        </div>
      </div>
      {isLoading ? <CellRunningIndicator /> : null}
      <div
        className="relative z-10 flex min-w-0 flex-1 items-center"
        style={{
          paddingLeft: "var(--marble-table-cell-content-padding-left, 0px)",
        }}
      >
        {isFailed ? (
          <span
            className="block min-w-0 overflow-hidden text-ellipsis text-red-500 text-xs"
            title={state.message}
          >
            ⚠ {state.message}
          </span>
        ) : isNull ? (
          <span className="text-xs text-zinc-300">—</span>
        ) : isLoading ? null : (
          <span className="block min-w-0 overflow-hidden text-ellipsis">
            {props.valueFormatted ?? props.value}
          </span>
        )}
      </div>
      {columnId && rowId && !isLoading && (
        <button
          className="absolute top-1/2 right-0.5 z-30 hidden h-[18px] w-[18px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm border border-zinc-200 bg-white text-[8px] text-orange-600 leading-none group-hover/cell:flex"
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

function escapeChangeTargetSelector(value: string) {
  if (typeof window !== "undefined" && window.CSS?.escape) {
    return window.CSS.escape(value);
  }

  return value.replaceAll('"', '\\"');
}

// ── Components ──────────────────────────────────────────

function InterpolationEditor({
  value,
  onChange,
  placeholder,
  currentTableId,
  referenceColumns,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  currentTableId?: string;
  referenceColumns: ReferenceableColumn[];
}) {
  const validTokens = useMemo(
    () =>
      new Set(
        referenceColumns.flatMap((column) =>
          column.tableId === currentTableId
            ? [
                column.label,
                column.name,
              ]
            : [
                column.label,
              ],
        ),
      ),
    [
      currentTableId,
      referenceColumns,
    ],
  );

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
          // Prism produces tokens like: <span class="token keyword col-name">Project / Table / Column</span>
          const regex = /<span class="token keyword col-name">([^<]+)<\/span>/g;
          html = html.replace(regex, (match, name) => {
            const isValid = validTokens.has(name);
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

export default function TablePageView({
  initialTablePageData,
}: {
  initialTablePageData: InitialTablePageData;
}) {
  const router = useRouter();
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
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

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
      const currentCell = cellsRef.current.find(
        (current) => current.id === cell.id,
      );
      const nextCell =
        runningCellIdsRef.current.has(cell.id) && !isTerminalCellState(state)
          ? {
              ...cell,
              manualInput: currentCell?.manualInput ?? cell.manualInput,
              state: {
                ok: null,
              } as Cell["state"],
            }
          : cell;

      if (isTerminalCellState(state)) {
        runningCellIdsRef.current.delete(cell.id);
      }

      const existing = cellsRef.current.some(
        (current) => current.id === nextCell.id,
      );

      if (existing) {
        pending.updates.set(nextCell.id, nextCell);
      } else {
        pending.inserts.set(nextCell.id, nextCell);
      }
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
          color: "#666",
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
                ? "#ffffff"
                : "#f4f4f5"
              : "#fafafa";
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
    const nextName = nameDraft.trim() || "Untitled Table";
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
        <RunLogSheet
          lines={runLog}
          onClear={() => setRunLog([])}
          onOpenChange={setRunLogSheetOpen}
          open={runLogSheetOpen}
        />
      </div>
    </MarblePane>
  );
}

// ── Column Sidebar ──────────────────────────────────────

function ColumnSidebar({
  columnSecretBindings,
  mode,
  columns,
  currentTableId,
  onOpenSecrets,
  programs,
  programSecretBindings,
  programSecretDeclarations,
  onCreateColumn,
  onUpdateColumn,
  onClose,
  referenceColumns,
  secrets,
}: {
  columnSecretBindings: ColumnSecretBindingMap;
  mode:
    | {
        kind: "create";
      }
    | {
        kind: "edit";
        columnId: string;
      };
  columns: Column[];
  currentTableId: string;
  onOpenSecrets: () => void;
  programs: Program[];
  programSecretBindings: ProgramSecretBindingMap;
  programSecretDeclarations: ProgramSecretDeclarationsByProgramId;
  onCreateColumn: (input: {
    name: string;
    programVersionId: string;
    inputTemplate: string;
    runCondition: boolean;
  }) => Promise<void>;
  onUpdateColumn: (input: {
    columnId: string;
    name?: string;
    programVersionId?: string;
    inputTemplate?: string;
    runCondition?: boolean;
    secretBindings?: SecretBindingInput[];
  }) => Promise<void>;
  onClose: () => void;
  referenceColumns: ReferenceableColumn[];
  secrets: SecretRecord[];
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
      (p) => p.id === editingColumn.programVersion?.programId,
    )?.programVersions?.[0];
    if (!programVersion) return {};
    const s = getProgramInputSchema(programVersion);
    const fs = s ? buildFieldsFromSchema(s) : [];
    return parseTemplateToFieldValues(
      editingColumn.inputTemplate ?? "{}",
      fs,
      referenceColumns,
    );
  };

  const [name, setName] = useState(editingColumn?.name ?? "");
  const [programId, setProgramId] = useState(
    editingColumn?.programVersion?.programId ?? "",
  );
  const [runConditionEnabled, setRunConditionEnabled] = useState(
    editingColumn?.runCondition === true,
  );
  const [secretBindings, setSecretBindings] = useState<Record<string, string>>(
    () => (editingColumn ? (columnSecretBindings[editingColumn.id] ?? {}) : {}),
  );
  const [fieldValues, setFieldValues] = useState(initFieldValues);
  const [saving, setSaving] = useState(false);
  const [outputSchemaOpen, setOutputSchemaOpen] = useState(false);
  const [outputSchemaJson, setOutputSchemaJson] = useState(() => {
    const config = getProgramOutputConfig(editingColumn?.programVersion);
    if (!config) return "{}";
    return JSON.stringify(config, null, 2);
  });
  const [outputSchemaDirty, setOutputSchemaDirty] = useState(false);
  const [savingOutputSchema, setSavingOutputSchema] = useState(false);

  const initialProgramId = useRef(programId);

  const selectedProgram = programs.find((p) => p.id === programId);
  const latestVersion = selectedProgram?.programVersions?.length
    ? (selectedProgram.programVersions
        .filter((version) => version.version !== null)
        .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0] ?? null)
    : null;

  const selectedSchema = getProgramInputSchema(latestVersion);
  const fields = selectedSchema ? buildFieldsFromSchema(selectedSchema) : [];
  const selectedProgramSecretDeclarations =
    programSecretDeclarations[programId] ?? [];
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

    const version = program.programVersions?.length
      ? (program.programVersions
          .filter((entry) => entry.version !== null)
          .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0] ?? null)
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
    setSecretBindings((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([envName]) =>
          selectedProgramSecretDeclarations.some(
            (declaration) => declaration.env === envName,
          ),
        ),
      ),
    );
  }, [
    programId,
    programs,
    selectedProgramSecretDeclarations,
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
            const reference = resolveReferenceColumnToken(
              inner,
              referenceColumns,
              currentTableId,
            );
            if (reference) {
              return `{{$.columns.${reference.column.id}.value${reference.restPath}}}`;
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
          if (
            !resolveReferenceColumnToken(
              inner,
              referenceColumns,
              currentTableId,
            )
          ) {
            return `Unrecognized column in formula: "${inner}". Please check your spelling.`;
          }
        }
      }
    }
    return null;
  };

  const validationError = validateTemplate();
  const secretBindingsForSave = Object.fromEntries(
    Object.entries(secretBindings).filter(([envName]) =>
      selectedProgramSecretDeclarations.some(
        (declaration) => declaration.env === envName,
      ),
    ),
  );

  const handleSave = async () => {
    if (!name.trim() || !programId || validationError || !latestVersion) return;
    setSaving(true);
    try {
      if (mode.kind === "create") {
        await onCreateColumn({
          inputTemplate: buildTemplate(),
          name: name.trim(),
          programVersionId: latestVersion.id,
          runCondition: runConditionEnabled,
        });
        setName("");
        setProgramId("");
        setFieldValues({});
        setRunConditionEnabled(false);
        onClose();
      } else {
        await onUpdateColumn({
          columnId: mode.columnId,
          inputTemplate: buildTemplate(),
          name: name.trim(),
          programVersionId: latestVersion.id,
          runCondition: runConditionEnabled,
          secretBindings: secretBindingMapToEntries(secretBindingsForSave),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const isCreate = mode.kind === "create";

  return (
    <aside className="flex w-80 min-h-0 flex-col overflow-hidden rounded-xs border-l border-taupe-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-taupe-200 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-medium text-taupe-950">
            {isCreate ? "New Column" : "Edit Column"}
          </h2>
          {!isCreate && editingColumn ? (
            <p className="truncate text-xs text-taupe-600">
              {editingColumn.name}
            </p>
          ) : null}
        </div>
        <button
          aria-label="Close column sidebar"
          className="flex size-8 shrink-0 items-center justify-center rounded-sm text-taupe-400 transition-colors hover:bg-taupe-100 hover:text-taupe-900"
          onClick={onClose}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
          <div className="space-y-1.5">
            <MarbleFieldLabel className="text-taupe-700">Name</MarbleFieldLabel>
            <MarbleInput
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Uppercased"
              type="text"
              value={name}
              wrapperClassName="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <MarbleFieldLabel className="text-taupe-700">
              Program
            </MarbleFieldLabel>
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
            <MarbleAlert
              size="sm"
              tone="warning"
            >
              This program reads from cell.manualInputValue — cells will be
              editable.
            </MarbleAlert>
          )}

          <div className="space-y-1.5">
            <MarbleFieldLabel className="text-taupe-700">
              Execution
            </MarbleFieldLabel>
            <MarbleSelect
              onChange={(event) =>
                setRunConditionEnabled(event.target.value === "auto")
              }
              value={runConditionEnabled ? "auto" : "manual"}
              wrapperClassName="w-full"
            >
              <option value="manual">Manual only</option>
              <option value="auto">Auto when ready</option>
            </MarbleSelect>
            <div className="text-[11px] text-taupe-500">
              Auto-run only happens after upstream cells execute and the
              resolved input validates for this program.
            </div>
          </div>

          {!programId ? null : isCreate ||
            selectedProgramSecretDeclarations.length === 0 ? (
            selectedProgramSecretDeclarations.length === 0 ? (
              <MarbleAlert
                size="sm"
                tone="neutral"
              >
                This program does not declare any named secrets.
              </MarbleAlert>
            ) : (
              <MarbleAlert
                size="sm"
                tone="neutral"
              >
                Program defaults apply automatically. Column-specific overrides
                appear after the column exists.
              </MarbleAlert>
            )
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <MarbleFieldLabel className="text-taupe-700">
                  Secret Overrides
                </MarbleFieldLabel>
                {secrets.length === 0 ? (
                  <MarbleButton
                    onClick={onOpenSecrets}
                    size="xs"
                    variant="light"
                  >
                    Open Secrets
                  </MarbleButton>
                ) : null}
              </div>

              {selectedProgramSecretDeclarations.map((declaration) => {
                const overrideSecretId = secretBindings[declaration.env];
                const resolution = describeColumnSecretResolution(declaration, {
                  overrideSecretId,
                  programDefaultSecretId:
                    programSecretBindings[programId]?.[declaration.env],
                  secrets,
                });

                return (
                  <div
                    className="space-y-3 rounded-xs border border-taupe-200 bg-taupe-50/60 p-3"
                    key={declaration.env}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-taupe-950">
                          {declaration.env}
                        </span>
                        <MarbleBadge tone={resolution.badgeTone}>
                          {resolution.badgeLabel}
                        </MarbleBadge>
                      </div>
                      <div className="text-xs text-taupe-700">
                        {declaration.label}
                      </div>
                      {declaration.description ? (
                        <div className="text-[11px] text-taupe-500">
                          {declaration.description}
                        </div>
                      ) : null}
                    </div>

                    <MarbleSelect
                      onChange={(event) =>
                        setSecretBindings((current) => {
                          const nextBindings = {
                            ...current,
                          };

                          if (event.target.value) {
                            nextBindings[declaration.env] = event.target.value;
                          } else {
                            delete nextBindings[declaration.env];
                          }

                          return nextBindings;
                        })
                      }
                      size="xs"
                      value={overrideSecretId ?? ""}
                      wrapperClassName="w-full"
                    >
                      <option value="">{resolution.inheritedLabel}</option>
                      {overrideSecretId &&
                      !secrets.some(
                        (secret) => secret.id === overrideSecretId,
                      ) ? (
                        <option value={overrideSecretId}>Missing secret</option>
                      ) : null}
                      {secrets.map((secret) => (
                        <option
                          key={secret.id}
                          value={secret.id}
                        >
                          {secret.name}
                        </option>
                      ))}
                    </MarbleSelect>

                    <div className="text-[11px] text-taupe-500">
                      {resolution.helperText}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {fields.length > 0 && (
            <div className="space-y-2.5">
              <MarbleFieldLabel className="text-taupe-700">
                Input Template
              </MarbleFieldLabel>
              {fields.map((f) => {
                const fv = fieldValues[f.key] ?? {
                  mode: "static",
                  value: "",
                };
                return (
                  <div
                    className="space-y-2 rounded-xs border border-taupe-200 bg-taupe-50/60 p-3"
                    key={f.key}
                  >
                    <div className="space-y-0.5">
                      <span className="block font-mono text-[11px] text-taupe-950">
                        {f.key}
                      </span>
                      <span className="block text-xs text-taupe-600">
                        {f.title}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-taupe-700">
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          checked={fv.mode === "static"}
                          className="accent-orange-500"
                          name={`mode-${f.key}`}
                          onChange={() =>
                            setFieldValues((prev) => ({
                              ...prev,
                              [f.key]: {
                                mode: "static",
                                value:
                                  f.defaultValue ?? f.enumValues?.[0] ?? "",
                              },
                            }))
                          }
                          type="radio"
                        />
                        Formula
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          checked={fv.mode === "column"}
                          className="accent-orange-500"
                          name={`mode-${f.key}`}
                          onChange={() =>
                            setFieldValues((prev) => ({
                              ...prev,
                              [f.key]: {
                                mode: "column",
                                value: referenceColumns[0]?.id ?? "",
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
                          currentTableId={currentTableId}
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
                          referenceColumns={referenceColumns}
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
                        {referenceColumns.map((col) => (
                          <option
                            key={col.id}
                            value={col.id}
                          >
                            {col.label}
                            {col.allowManualInput ? " (input)" : ""}
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
            <div className="border-t border-taupe-200 pt-4">
              <button
                className="flex w-full items-center gap-1.5 text-left text-[10px] text-taupe-600 uppercase tracking-wider"
                onClick={() => setOutputSchemaOpen((o) => !o)}
                type="button"
              >
                <span
                  className={cx(
                    "text-[8px] transition-transform",
                    outputSchemaOpen && "rotate-90",
                  )}
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
                    disabled={
                      !latestVersion || !outputSchemaDirty || savingOutputSchema
                    }
                    onClick={async () => {
                      if (!latestVersion) return;
                      let parsed: unknown;
                      try {
                        parsed = JSON.parse(outputSchemaJson);
                      } catch {
                        return;
                      }
                      setSavingOutputSchema(true);
                      try {
                        await updateProgramOutputSchema(
                          latestVersion.id,
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

        <div className="shrink-0 space-y-3 border-t border-taupe-200 bg-taupe-50 px-4 py-2.5">
          {validationError && (
            <MarbleAlert
              size="sm"
              tone="error"
            >
              {validationError}
            </MarbleAlert>
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
                ? "Create column"
                : "Save Changes"}
          </MarbleButton>
        </div>
      </div>
    </aside>
  );
}
