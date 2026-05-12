import { toCamelKeys } from "@marble/lib/object";
import { hydrateColumnRecord } from "./mutations";
import type {
  BroadcastRecord,
  Cell,
  Column,
  ColumnRecord,
  Program,
  Row,
  TableInfo,
} from "./types";

export function normalizeBroadcastCell(row: BroadcastRecord): Cell {
  return toCamelKeys(row) as Cell;
}

export function normalizeBroadcastColumn(
  row: BroadcastRecord,
  programs: Program[],
): Column {
  return hydrateColumnRecord(toCamelKeys(row) as ColumnRecord, programs);
}

export function normalizeBroadcastRow(row: BroadcastRecord): Row {
  return toCamelKeys(row) as Row;
}

export function normalizeBroadcastTablePatch(
  row: BroadcastRecord,
): Partial<TableInfo> & {
  id: string;
} {
  return toCamelKeys(row) as Partial<TableInfo> & {
    id: string;
  };
}
