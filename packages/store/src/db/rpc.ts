import type { CreateParams } from "../types";

export type InsertTableRowsInput = {
  idx: number;
  ownerProfileId: string;
  quantity: number;
  tableId: string;
};

export type InsertTableRowsResult = {
  cellCount: number;
  cells: {
    columnId: string;
    id: string;
    rowId: string;
  }[];
  rowCount: number;
  rows: {
    id: string;
    idx: number;
  }[];
};

export type CreateSourceEventInput = {
  rawPayload: CreateParams<"source_event">["rawPayload"];
  sourceId: string;
};

type TableInsertRowsRpcResult = {
  cellCount: number;
  cells?: {
    columnId: string;
    id: string;
    rowId: string;
  }[];
  rowCount: number;
  rows?: {
    id: string;
    idx: number;
  }[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseTableInsertRowsResult = (
  value: unknown,
): TableInsertRowsRpcResult => {
  if (
    !isRecord(value) ||
    typeof value.rowCount !== "number" ||
    typeof value.cellCount !== "number"
  ) {
    throw new Error("table_insert_rows returned an unexpected payload.");
  }

  return value as TableInsertRowsRpcResult;
};
