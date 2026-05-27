import { getErrorMessage } from "@marble/lib/result";
import type { MarbleClient } from "@marble/sdk";
import type { MarbleConfirmModalState } from "@marble/ui";
import type { CellContextMenuEvent } from "ag-grid-community";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useState } from "react";

import {
  createColumn,
  deleteColumn,
  deleteRow,
  hydrateColumnRecord,
  updateColumn,
  updateColumnSecretBindings,
} from "./mutations";
import { secretBindingEntriesToMap } from "./schema-fields";
import type {
  Cell,
  Column,
  ColumnSecretBindingMap,
  ContextMenuState,
  GridContext,
  Program,
  SecretBindingInput,
  SidebarMode,
} from "./types";

type UpdateColumnInput = {
  columnId: string;
  inputTemplate?: string;
  name?: string;
  programVersionId?: string;
  runCondition?: boolean;
  secretBindings?: SecretBindingInput[];
};

type CreateColumnInput = {
  inputTemplate: string;
  name: string;
  programVersionId: string;
  runCondition: boolean;
};

type UseColumnControlsInput = {
  columnsRef: RefObject<Column[]>;
  programs: Program[];
  refreshReferenceColumns: () => Promise<void>;
  runCell: (columnId: string, rowId: string) => void;
  sdk: MarbleClient;
  selectedTableId: string;
  setColumnSecretBindings: Dispatch<SetStateAction<ColumnSecretBindingMap>>;
  setSidebarMode: Dispatch<SetStateAction<SidebarMode>>;
  setTableError: Dispatch<SetStateAction<null | string>>;
  sidebarMode: SidebarMode;
  upsertLocalCells: (cells: Cell[]) => void;
  upsertLocalColumn: (column: Column) => void;
};

export const useColumnControls = ({
  columnsRef,
  programs,
  refreshReferenceColumns,
  runCell,
  sdk,
  selectedTableId,
  setColumnSecretBindings,
  setSidebarMode,
  setTableError,
  sidebarMode,
  upsertLocalCells,
  upsertLocalColumn,
}: UseColumnControlsInput) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [confirmState, setConfirmState] =
    useState<MarbleConfirmModalState | null>(null);

  const handleDeleteColumn = async (columnId: string) => {
    await deleteColumn(sdk, columnId);
    setColumnSecretBindings((current) => {
      const nextBindings = {
        ...current,
      };

      delete nextBindings[columnId];
      return nextBindings;
    });
    await refreshReferenceColumns();
  };

  const handleDeleteRow = async (rowId: string) => {
    await deleteRow(sdk, rowId);
  };

  const handleCreateColumn = async (input: CreateColumnInput) => {
    if (!selectedTableId) {
      return;
    }

    setTableError(null);
    try {
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
    } catch (error) {
      setTableError(getErrorMessage(error));
      throw error;
    }
  };

  const handleUpdateColumn = async (input: UpdateColumnInput) => {
    setTableError(null);
    try {
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
    } catch (error) {
      setTableError(getErrorMessage(error));
      throw error;
    }
  };

  const requestDeleteColumn = (columnId: string) => {
    const col = columnsRef.current.find((column) => column.id === columnId);
    setConfirmState({
      confirmLabel: "Delete",
      message: `Delete "${col?.name ?? "this column"}"? All cells in this column will be permanently removed.`,
      onConfirm: () => {
        void handleDeleteColumn(columnId);
        setSidebarMode((current) =>
          current.kind === "edit" && current.columnId === columnId
            ? {
                kind: "closed",
              }
            : current,
        );
      },
      title: "Delete Column",
    });
  };

  const requestDeleteRow = (rowId: string, rowIndex: number) => {
    setConfirmState({
      confirmLabel: "Delete",
      message: `Delete Row ${rowIndex + 1}? All cells in this row will be permanently removed.`,
      onConfirm: () => {
        void handleDeleteRow(rowId);
      },
      title: "Delete Row",
    });
  };

  const handleHeaderClick = (columnId: string) => {
    setSidebarMode({
      columnId,
      kind: "edit",
    });
  };

  const handleHeaderContextMenu = (columnId: string, x: number, y: number) => {
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
  };

  const onCellContextMenu = (event: CellContextMenuEvent) => {
    const browserEvent = event.event as MouseEvent | undefined;
    browserEvent?.preventDefault();
    if (event.colDef.headerName !== "#") {
      return;
    }

    const rowId = event.data?._rowId as string | undefined;
    const rowIndex = event.data?._rowIndex as number | undefined;
    if (!rowId || rowIndex === undefined || !browserEvent) {
      return;
    }

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
  };

  const gridContext: GridContext = {
    activeColumnId: sidebarMode.kind === "edit" ? sidebarMode.columnId : null,
    onHeaderClick: handleHeaderClick,
    onHeaderContextMenu: handleHeaderContextMenu,
    openCreateColumn: () =>
      setSidebarMode({
        kind: "create",
      }),
    runCell,
  };

  return {
    confirmState,
    contextMenu,
    gridContext,
    handleCreateColumn,
    handleUpdateColumn,
    onCellContextMenu,
    setConfirmState,
    setContextMenu,
  };
};
