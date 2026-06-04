import {
  cx,
  MarbleAlert,
  MarbleConfirmModal,
  MarbleMenuButton,
  MarblePane,
  MarblePaneEditableCrumb,
} from "@marble/ui";
import type { ColDef } from "ag-grid-community";
import type { AgGridReact } from "ag-grid-react";
import type {
  ComponentProps,
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";

import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../../../../change-spotlight";

import { CellInspectorModal } from "../cell-inspector";
import { DATE_FORMATTER } from "../constants";
import { ContextMenu } from "../context-menu";
import { EditableName } from "../editable-name";
import { RunColumnModal } from "../run-column-modal";
import { RunLogSheet } from "../run-log";
import { ColumnSidebar } from "../sidebar";
import type {
  Cell,
  Column,
  ColumnSecretBindingMap,
  ContextMenuState,
  GridContext,
  InspectedCell,
  Program,
  ProgramSecretBindingMap,
  ProgramSecretDeclarationsByProgramId,
  ReferenceableColumn,
  RunColumnCountModalState,
  SecretRecord,
  SidebarMode,
  TableInfo,
} from "../types";
import { TableGrid } from "./grid";

type ColumnSidebarProps = ComponentProps<typeof ColumnSidebar>;
type GridProps = ComponentProps<typeof AgGridReact>;

type TableSurfaceProps = {
  colDefs: ColDef[];
  cellsRef: RefObject<Cell[]>;
  columnSecretBindings: ColumnSecretBindingMap;
  columnsRef: RefObject<Column[]>;
  commitName: () => Promise<void>;
  confirmState: ComponentProps<typeof MarbleConfirmModal>["state"];
  contextMenu: ContextMenuState;
  deletingTable: boolean;
  editingSurface: null | "crumb" | "title";
  gridContext: GridContext;
  gridRef: RefObject<AgGridReact | null>;
  handleAddRows: () => Promise<void>;
  handleCreateColumn: ColumnSidebarProps["onCreateColumn"];
  handleUpdateColumn: ColumnSidebarProps["onUpdateColumn"];
  hasRowCountInput: boolean;
  inspectedCell: InspectedCell | null;
  nameDraft: string;
  onCellContextMenu: GridProps["onCellContextMenu"];
  onCellValueChanged: GridProps["onCellValueChanged"];
  onColumnMoved: GridProps["onColumnMoved"];
  onOpenSecrets: () => void;
  programSecretBindings: ProgramSecretBindingMap;
  programSecretDeclarations: ProgramSecretDeclarationsByProgramId;
  programs: Program[];
  referenceColumns: ReferenceableColumn[];
  requestDeleteTable: () => void;
  rowCount: number;
  rowCountInput: string;
  rowData: Record<string, unknown>[];
  runColumn: (columnId: string, limit?: number) => void;
  runColumnCountModal: RunColumnCountModalState;
  runLog: string[];
  runLogSheetOpen: boolean;
  secrets: SecretRecord[];
  selectedTable: TableInfo;
  selectedTableId: string;
  setConfirmState: Dispatch<SetStateAction<TableSurfaceProps["confirmState"]>>;
  setContextMenu: Dispatch<SetStateAction<ContextMenuState>>;
  setInspectedCell: Dispatch<SetStateAction<InspectedCell | null>>;
  setNameDraft: Dispatch<SetStateAction<string>>;
  setRowCountInput: Dispatch<SetStateAction<string>>;
  setRunColumnCountModal: Dispatch<SetStateAction<RunColumnCountModalState>>;
  setRunLog: Dispatch<SetStateAction<string[]>>;
  setRunLogSheetOpen: Dispatch<SetStateAction<boolean>>;
  setSidebarMode: Dispatch<SetStateAction<SidebarMode>>;
  sidebarMode: SidebarMode;
  sortedColumns: Column[];
  startEditingName: (surface: "crumb" | "title") => void;
  stopEditingName: () => void;
  tableError: null | string;
};

export const TableSurface = ({
  colDefs,
  cellsRef,
  columnSecretBindings,
  columnsRef,
  commitName,
  confirmState,
  contextMenu,
  deletingTable,
  editingSurface,
  gridContext,
  gridRef,
  handleAddRows,
  handleCreateColumn,
  handleUpdateColumn,
  hasRowCountInput,
  inspectedCell,
  nameDraft,
  onCellContextMenu,
  onCellValueChanged,
  onColumnMoved,
  onOpenSecrets,
  programSecretBindings,
  programSecretDeclarations,
  programs,
  referenceColumns,
  requestDeleteTable,
  rowCount,
  rowCountInput,
  rowData,
  runColumn,
  runColumnCountModal,
  runLog,
  runLogSheetOpen,
  secrets,
  selectedTable,
  selectedTableId,
  setConfirmState,
  setContextMenu,
  setInspectedCell,
  setNameDraft,
  setRowCountInput,
  setRunColumnCountModal,
  setRunLog,
  setRunLogSheetOpen,
  setSidebarMode,
  sidebarMode,
  sortedColumns,
  startEditingName,
  stopEditingName,
  tableError,
}: TableSurfaceProps) => (
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
    disclosureActions={[
      {
        disabled: deletingTable,
        label: deletingTable ? "Deleting..." : "Delete table",
        onSelect: requestDeleteTable,
        tone: "danger",
      },
    ]}
    disclosureAriaLabel="Open table actions"
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
            <MarbleMenuButton
              ariaLabel="Open table export menu"
              items={[
                {
                  label: "CSV",
                  onSelect: () => {
                    window.location.assign(
                      `/projects/${selectedTable.projectId}/tables/${selectedTable.id}/export`,
                    );
                  },
                },
              ]}
              label="Export"
            />
          </div>
        </div>

        {tableError ? (
          <MarbleAlert
            className="mb-3"
            tone="error"
          >
            {tableError}
          </MarbleAlert>
        ) : null}

        <TableGrid
          cellsRef={cellsRef}
          colDefs={colDefs}
          columnsRef={columnsRef}
          gridContext={gridContext}
          gridRef={gridRef}
          handleAddRows={handleAddRows}
          hasRowCountInput={hasRowCountInput}
          onCellContextMenu={onCellContextMenu}
          onCellValueChanged={onCellValueChanged}
          onColumnMoved={onColumnMoved}
          rowCount={rowCount}
          rowCountInput={rowCountInput}
          rowData={rowData}
          selectedTableId={selectedTableId}
          setInspectedCell={setInspectedCell}
          setRowCountInput={setRowCountInput}
          setRunLogSheetOpen={setRunLogSheetOpen}
        />
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
          onOpenSecrets={onOpenSecrets}
          onUpdateColumn={handleUpdateColumn}
          programSecretBindings={programSecretBindings}
          programSecretDeclarations={programSecretDeclarations}
          programs={programs}
          referenceColumns={referenceColumns}
          secrets={secrets}
        />
      )}

      {contextMenu && (
        <ContextMenu
          onClose={() => setContextMenu(null)}
          state={contextMenu}
        />
      )}
      <MarbleConfirmModal
        onClose={() => setConfirmState(null)}
        state={confirmState}
      />
      <RunColumnModal
        onClose={() => setRunColumnCountModal(null)}
        onConfirm={(columnId, count) => runColumn(columnId, count)}
        state={runColumnCountModal}
      />
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
