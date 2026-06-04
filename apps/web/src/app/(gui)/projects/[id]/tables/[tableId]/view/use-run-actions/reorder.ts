import type { MarbleClient } from "@marble/sdk";
import type { ColumnMovedEvent } from "ag-grid-community";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type { Column } from "../types";

type ColumnMovedDeps = {
  columnsRef: RefObject<Column[]>;
  gridRef: RefObject<{
    api: {
      getColumnState: () => Array<{
        colId: string;
      }>;
    };
  } | null>;
  sdk: MarbleClient;
  setColumns: Dispatch<SetStateAction<Column[]>>;
};

export const createColumnMovedHandler =
  ({ columnsRef, gridRef, sdk, setColumns }: ColumnMovedDeps) =>
  async (event: ColumnMovedEvent) => {
    if (!event.finished) {
      return;
    }

    const gridApi = gridRef.current?.api;
    if (!gridApi) {
      return;
    }

    const columnState = gridApi.getColumnState();
    const orderedColIds = columnState
      .map((col) => col.colId)
      .filter((colId) => columnsRef.current.some((c) => c.id === colId));

    const newIdxMap = new Map<string, number>(
      orderedColIds.map((id, index) => [
        id,
        index,
      ]),
    );

    const updates: Array<{
      id: string;
      idx: number;
    }> = [];
    const updatedColumns = columnsRef.current.map((col) => {
      const nextIdx = newIdxMap.get(col.id);
      if (nextIdx !== undefined && nextIdx !== col.idx) {
        updates.push({
          id: col.id,
          idx: nextIdx,
        });
        return {
          ...col,
          idx: nextIdx,
        };
      }
      return col;
    });

    if (updates.length === 0) {
      return;
    }

    setColumns(updatedColumns);
    columnsRef.current = updatedColumns;

    try {
      await Promise.all(
        updates.map((update) =>
          sdk.columns.update({
            id: update.id,
            values: {
              idx: 10000 + update.idx,
            },
          }),
        ),
      );

      await Promise.all(
        updates.map((update) =>
          sdk.columns.update({
            id: update.id,
            values: {
              idx: update.idx,
            },
          }),
        ),
      );
    } catch (error) {
      console.error("Failed to persist column reordering:", error);
    }
  };
