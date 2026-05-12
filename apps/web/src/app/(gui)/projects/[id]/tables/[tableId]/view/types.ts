import type {
  DeleteMutation,
  UpsertMutation,
} from "@/lib/realtime/broadcast-mutations";
import type { TablePageData } from "../actions";

export type InitialTablePageData = TablePageData;
export type Program = InitialTablePageData["programs"][number];
export type TableInfo = InitialTablePageData["table"];
export type ReferenceableColumn =
  InitialTablePageData["referenceColumns"][number];
export type Column = InitialTablePageData["columns"][number];
export type ColumnRecord = Omit<Column, "programVersion">;
export type Row = InitialTablePageData["rows"][number];
export type Cell = InitialTablePageData["cells"][number];
export type SecretRecord = InitialTablePageData["secrets"][number];
export type ProgramSecretBindingMap =
  InitialTablePageData["programSecretBindings"];
export type ColumnSecretBindingMap =
  InitialTablePageData["columnSecretBindings"];
export type ProgramSecretDeclarationsByProgramId =
  InitialTablePageData["programSecretDeclarations"];
export type BroadcastRecord = Record<string, unknown>;
export type SecretBindingInput = {
  envName: string;
  secretId: string;
};
export type RunExecutionResult = {
  output: unknown;
  runId: string;
  success: boolean;
};
export type TableMutation =
  | DeleteMutation<"cell:delete", BroadcastRecord>
  | UpsertMutation<"cell:upsert", BroadcastRecord>
  | DeleteMutation<"column:delete", BroadcastRecord>
  | UpsertMutation<"column:upsert", BroadcastRecord>
  | DeleteMutation<"row:delete", BroadcastRecord>
  | UpsertMutation<"row:upsert", BroadcastRecord>
  | DeleteMutation<"table:delete", BroadcastRecord>
  | UpsertMutation<"table:upsert", BroadcastRecord>;
export type SidebarMode =
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

export type ContextMenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
} | null;

export type GridContext = {
  runCell: (columnId: string, rowId: string) => void;
  onHeaderClick: (columnId: string) => void;
  onHeaderContextMenu: (columnId: string, x: number, y: number) => void;
  openCreateColumn: () => void;
  activeColumnId: string | null;
};

export type CellState =
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

export type SchemaField = {
  key: string;
  type: string;
  title: string;
  required: boolean;
  enumValues?: string[];
  defaultValue?: string;
};

export type InspectedCell = {
  columnName: string;
  rowIndex: number;
  state: CellState;
  manualInput: string | null;
};
