import type { ColDef } from "ag-grid-community";
import { useMemo } from "react";

import {
  GRID_CELL_BACKGROUNDS,
  GRID_ROW_NUMBER_COLOR,
  TABLE_CELL_HORIZONTAL_PADDING_PX,
  TABLE_CELL_LED_CLEARANCE_PX,
  TABLE_CELL_LED_GUTTER_PX,
} from "../grid-theme";

import { displayCellValue, getCellState, isManualInputColumn } from "./cell";
import { CellWithRunButton, RowNumberCell } from "./cell-renderers";
import { AddColumnButton, ColumnHeader } from "./column-header";
import type { Cell, Column, Row, SidebarMode } from "./types";

type UseGridModelInput = {
  cellMap: Map<string, Cell>;
  columns: Column[];
  rows: Row[];
  sidebarMode: SidebarMode;
};

export const useGridModel = ({
  cellMap,
  columns,
  rows,
  sidebarMode,
}: UseGridModelInput) => {
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
    const activeColumnId =
      sidebarMode.kind === "edit" ? sidebarMode.columnId : null;

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
        const isActiveColumn = activeColumnId === col.id;

        return {
          cellRenderer: CellWithRunButton,
          cellStyle: (params) => {
            const hasValue = params.value && String(params.value).trim() !== "";
            const baseBackground = editable
              ? hasValue
                ? GRID_CELL_BACKGROUNDS.editableFilled
                : GRID_CELL_BACKGROUNDS.editableEmpty
              : GRID_CELL_BACKGROUNDS.readonly;
            const background = isActiveColumn
              ? GRID_CELL_BACKGROUNDS.activeColumn
              : baseBackground;
            return {
              "--marble-table-cell-background": background,
              "--marble-table-cell-content-padding-left": `${TABLE_CELL_LED_CLEARANCE_PX}px`,
              "--marble-table-cell-led-gutter-width": `${TABLE_CELL_LED_GUTTER_PX - 4}px`,
              "--marble-table-cell-padding-inline": `${TABLE_CELL_HORIZONTAL_PADDING_PX}px`,
              background:
                editable || isActiveColumn ? background : "transparent",
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
    sidebarMode,
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

  return {
    colDefs,
    rowData,
    sortedColumns,
  };
};
