import { getErrorMessage } from "@marble/lib/result";
import { normalizeDisplayLabel } from "@marble/lib/string";
import type { MarbleClient } from "@marble/sdk";
import type { MarbleConfirmModalState } from "@marble/ui";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useRef } from "react";

import type { TableInfo } from "./types";

type EditingSurface = null | "crumb" | "title";

type UseTableTitleActionsInput = {
  editingSurface: EditingSurface;
  mergeTable: (patch: Partial<TableInfo>) => void;
  nameDraft: string;
  onDeleted: (projectId: string) => void;
  sdk: MarbleClient;
  setConfirmState: Dispatch<SetStateAction<MarbleConfirmModalState | null>>;
  setDeletingTable: Dispatch<SetStateAction<boolean>>;
  setEditingSurface: Dispatch<SetStateAction<EditingSurface>>;
  setNameDraft: Dispatch<SetStateAction<string>>;
  setTableError: Dispatch<SetStateAction<null | string>>;
  table: TableInfo;
  tableRef: RefObject<TableInfo>;
};

export const useTableTitleActions = ({
  editingSurface,
  mergeTable,
  nameDraft,
  onDeleted,
  sdk,
  setConfirmState,
  setDeletingTable,
  setEditingSurface,
  setNameDraft,
  setTableError,
  table,
  tableRef,
}: UseTableTitleActionsInput) => {
  const renameRequestRef = useRef(0);
  const renameInFlightRef = useRef(false);
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
    setNameDraft,
  ]);

  const stopEditingName = () => {
    setEditingSurface(null);
    setNameDraft(selectedTableName);
  };

  const commitName = async () => {
    const nextName = normalizeDisplayLabel(nameDraft, "Untitled Table");
    const previousTable = tableRef.current;

    if (nextName === previousTable.name) {
      setEditingSurface(null);
      setNameDraft(previousTable.name);
      return;
    }

    const requestId = renameRequestRef.current + 1;
    renameRequestRef.current = requestId;
    renameInFlightRef.current = true;
    setTableError(null);
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
      setTableError(getErrorMessage(error));
    } finally {
      if (renameRequestRef.current === requestId) {
        renameInFlightRef.current = false;
      }
    }
  };

  const startEditingName = (surface: "crumb" | "title") => {
    if (renameInFlightRef.current) {
      return;
    }

    setEditingSurface(surface);
  };

  const performDeleteTable = async () => {
    const currentTable = tableRef.current;
    setDeletingTable(true);
    setTableError(null);

    try {
      await sdk.tables.delete({
        id: currentTable.id,
      });
      onDeleted(currentTable.projectId);
    } catch (error) {
      setTableError(getErrorMessage(error));
      setDeletingTable(false);
    }
  };

  const requestDeleteTable = () => {
    const currentTable = tableRef.current;

    setConfirmState({
      confirmLabel: "Delete table",
      message: `Delete table "${currentTable.name}"? Its rows, cells, and any pipes that target it will also be deleted.`,
      onConfirm: () => {
        void performDeleteTable();
      },
      title: "Delete table",
    });
  };

  return {
    commitName,
    requestDeleteTable,
    selectedTable,
    selectedTableName,
    startEditingName,
    stopEditingName,
  };
};
