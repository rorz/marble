import "server-only";

import { normalizeDisplayLabel } from "@marble/lib/string";
import type { Stringifier } from "csv-stringify";
import { stringify } from "csv-stringify";
import type { TablePageData } from "../actions";
import { displayCellValue } from "../view/cell";

const tableCsvContentType = "text/csv; charset=utf-8";

const toDownloadFilename = (tableName: string) => {
  const label = normalizeDisplayLabel(tableName, "table");
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "table"}.csv`;
};

export const tableCsvHeaders = (tableName: string) => {
  const filename = toDownloadFilename(tableName);

  return {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Content-Type": tableCsvContentType,
  };
};

export const createTableCsvStream = (data: TablePageData): Stringifier => {
  const columns = [
    ...data.columns,
  ].sort((left, right) => left.idx - right.idx);
  const rows = [
    ...data.rows,
  ].sort((left, right) => left.idx - right.idx);
  const cellMap = new Map(
    data.cells.map((cell) => [
      `${cell.rowId}:${cell.columnId}`,
      cell,
    ]),
  );
  const stream = stringify({
    bom: true,
    escape_formulas: true,
    record_delimiter: "\r\n",
  });

  stream.write([
    "#",
    ...columns.map((column) => column.name),
  ]);

  for (const [index, row] of rows.entries()) {
    stream.write([
      String(index + 1),
      ...columns.map((column) =>
        displayCellValue(cellMap.get(`${row.id}:${column.id}`)),
      ),
    ]);
  }

  stream.end();

  return stream;
};
