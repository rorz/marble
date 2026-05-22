import { MarbleButton, MarbleInput } from "@marble/ui";
import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import type {
  ComponentProps,
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";

import { gridTheme } from "../../grid-theme";

import { getCellState, isManualInputColumn } from "../cell";
import type { Cell, Column, GridContext, InspectedCell } from "../types";

type GridProps = ComponentProps<typeof AgGridReact>;

type TableGridProps = {
  cellsRef: RefObject<Cell[]>;
  colDefs: ColDef[];
  columnsRef: RefObject<Column[]>;
  gridContext: GridContext;
  gridRef: RefObject<AgGridReact | null>;
  handleAddRows: () => Promise<void>;
  hasRowCountInput: boolean;
  onCellContextMenu: GridProps["onCellContextMenu"];
  onCellValueChanged: GridProps["onCellValueChanged"];
  onColumnMoved: GridProps["onColumnMoved"];
  rowCount: number;
  rowCountInput: string;
  rowData: Record<string, unknown>[];
  selectedTableId: string;
  setInspectedCell: Dispatch<SetStateAction<InspectedCell | null>>;
  setRowCountInput: Dispatch<SetStateAction<string>>;
  setRunLogSheetOpen: Dispatch<SetStateAction<boolean>>;
};

export const TableGrid = ({
  cellsRef,
  colDefs,
  columnsRef,
  gridContext,
  gridRef,
  handleAddRows,
  hasRowCountInput,
  onCellContextMenu,
  onCellValueChanged,
  onColumnMoved,
  rowCount,
  rowCountInput,
  rowData,
  selectedTableId,
  setInspectedCell,
  setRowCountInput,
  setRunLogSheetOpen,
}: TableGridProps) => (
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
              (column) => column.id === columnId,
            );
            if (!col) return;
            if (isManualInputColumn(col)) return;
            const rowId = event.data?._rowId as string;
            const cell = cellsRef.current.find(
              (current) =>
                current.rowId === rowId && current.columnId === columnId,
            );
            setInspectedCell({
              columnName: col.name,
              manualInput: cell?.manualInput ?? null,
              rowIndex: event.data?._rowIndex as number,
              state: getCellState(cell),
            });
          }}
          onCellValueChanged={onCellValueChanged}
          onColumnMoved={onColumnMoved}
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
          onClick={() => void handleAddRows()}
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
);
