"use client";
import { useMarbleRouter } from "@marble/ui";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type { AgGridReact } from "ag-grid-react";
import { useRef } from "react";

import { useMarbleSdk, useMarbleWebSessionSdk } from "@/lib/marble-sdk-client";

import { TableSurface } from "./surface";
import type { InitialTablePageData } from "./types";
import { useColumnControls } from "./use-column-controls";
import { useGridModel } from "./use-grid-model";
import { useRunActions } from "./use-run-actions";
import { useTableChangeSpotlight } from "./use-table-change-spotlight";
import { useTableRealtime } from "./use-table-realtime";
import { useTableRecords } from "./use-table-records";
import { useTableTitleActions } from "./use-table-title-actions";

ModuleRegistry.registerModules([
  AllCommunityModule,
]);

const TablePageView = ({
  initialTablePageData,
}: {
  initialTablePageData: InitialTablePageData;
}) => {
  const router = useMarbleRouter();
  const {
    applyClientErrorToCell,
    applyRunOutputToCell,
    cellMap,
    cellsRef,
    columnSecretBindings,
    columns,
    columnsRef,
    deletingTable,
    editingSurface,
    inspectedCell,
    markCellAsRunning,
    mergeTable,
    nameDraft,
    referenceColumns,
    removeLocalColumn,
    removeLocalRow,
    rows,
    rowsRef,
    runLog,
    runLogSheetOpen,
    selectedTableId,
    setCells,
    setColumnSecretBindings,
    setColumns,
    setDeletingTable,
    setEditingSurface,
    setInspectedCell,
    setNameDraft,
    setReferenceColumns,
    setRows,
    setRunLog,
    setRunLogSheetOpen,
    setRunning,
    setSidebarMode,
    setTableError,
    sidebarMode,
    table,
    tableError,
    tableRef,
    upsertLocalCells,
    upsertLocalColumn,
    upsertLocalRow,
  } = useTableRecords(initialTablePageData);
  const programs = initialTablePageData.programs;
  const secrets = initialTablePageData.secrets;
  const programSecretBindings = initialTablePageData.programSecretBindings;
  const programSecretDeclarations =
    initialTablePageData.programSecretDeclarations;
  const gridRef = useRef<AgGridReact>(null);
  const sdk = useMarbleSdk({
    profileId: table.projectOwnerProfileId,
  });
  const webSessionSdk = useMarbleWebSessionSdk({
    profileId: table.projectOwnerProfileId,
  });

  const refreshReferenceColumns = async () => {
    setReferenceColumns(
      await sdk.columns.listReferenceable({
        projectId: tableRef.current.projectId,
      }),
    );
  };

  useTableRealtime({
    cellsRef,
    mergeTable,
    onTableDeleted: () => {
      router.push(`/projects/${tableRef.current.projectId}`);
    },
    programs,
    removeLocalColumn,
    removeLocalRow,
    selectedTableId,
    setCells,
    upsertLocalCells,
    upsertLocalColumn,
    upsertLocalRow,
  });

  const { colDefs, rowData, sortedColumns } = useGridModel({
    cellMap,
    columns,
    rows,
    sidebarMode,
  });

  const {
    handleAddRows,
    hasRowCountInput,
    onCellValueChanged,
    onColumnMoved,
    rowCount,
    rowCountInput,
    runCell,
    setRowCountInput,
  } = useRunActions({
    applyClientErrorToCell,
    applyRunOutputToCell,
    cellsRef,
    columnsRef,
    gridRef,
    markCellAsRunning,
    rowsRef,
    runSdk: webSessionSdk,
    sdk,
    selectedTableId,
    setColumns,
    setRows,
    setRunLog,
    setRunning,
    upsertLocalCells,
  });

  const {
    confirmState,
    contextMenu,
    gridContext,
    handleCreateColumn,
    handleUpdateColumn,
    onCellContextMenu,
    setConfirmState,
    setContextMenu,
  } = useColumnControls({
    columnsRef,
    programs,
    refreshReferenceColumns,
    runCell,
    sdk,
    secretBindingSdk: webSessionSdk,
    selectedTableId,
    setColumnSecretBindings,
    setSidebarMode,
    setTableError,
    sidebarMode,
    upsertLocalCells,
    upsertLocalColumn,
  });

  const {
    commitName,
    requestDeleteTable,
    selectedTable,
    startEditingName,
    stopEditingName,
  } = useTableTitleActions({
    editingSurface,
    mergeTable,
    nameDraft,
    onDeleted: (projectId) => {
      router.push(`/projects/${projectId}`);
    },
    sdk,
    setConfirmState,
    setDeletingTable,
    setEditingSurface,
    setNameDraft,
    setTableError,
    table,
    tableRef,
  });

  useTableChangeSpotlight({
    columnsRef,
    gridRef,
    rowsRef,
    selectedTableId,
  });

  return (
    <TableSurface
      cellsRef={cellsRef}
      colDefs={colDefs}
      columnSecretBindings={columnSecretBindings}
      columnsRef={columnsRef}
      commitName={commitName}
      confirmState={confirmState}
      contextMenu={contextMenu}
      deletingTable={deletingTable}
      editingSurface={editingSurface}
      gridContext={gridContext}
      gridRef={gridRef}
      handleAddRows={handleAddRows}
      handleCreateColumn={handleCreateColumn}
      handleUpdateColumn={handleUpdateColumn}
      hasRowCountInput={hasRowCountInput}
      inspectedCell={inspectedCell}
      nameDraft={nameDraft}
      onCellContextMenu={onCellContextMenu}
      onCellValueChanged={onCellValueChanged}
      onColumnMoved={onColumnMoved}
      onOpenSecrets={() => router.push("/secrets")}
      programSecretBindings={programSecretBindings}
      programSecretDeclarations={programSecretDeclarations}
      programs={programs}
      referenceColumns={referenceColumns}
      requestDeleteTable={requestDeleteTable}
      rowCount={rowCount}
      rowCountInput={rowCountInput}
      rowData={rowData}
      runLog={runLog}
      runLogSheetOpen={runLogSheetOpen}
      secrets={secrets}
      selectedTable={selectedTable}
      selectedTableId={selectedTableId}
      setConfirmState={setConfirmState}
      setContextMenu={setContextMenu}
      setInspectedCell={setInspectedCell}
      setNameDraft={setNameDraft}
      setRowCountInput={setRowCountInput}
      setRunLog={setRunLog}
      setRunLogSheetOpen={setRunLogSheetOpen}
      setSidebarMode={setSidebarMode}
      sidebarMode={sidebarMode}
      sortedColumns={sortedColumns}
      startEditingName={startEditingName}
      stopEditingName={stopEditingName}
      tableError={tableError}
    />
  );
};
export default TablePageView;
