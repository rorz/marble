import type { Dispatch, SetStateAction } from "react";
import { startTransition, useEffect, useRef } from "react";

import { usePrivateBroadcast } from "@/lib/realtime/private-broadcast";

import {
  normalizeBroadcastCell,
  normalizeBroadcastColumn,
  normalizeBroadcastRow,
  normalizeBroadcastTablePatch,
} from "./broadcast";
import { getCellState, isRunningCellState } from "./cell";
import { isTableMutation } from "./constants";
import type { Cell, Program, TableInfo, TableMutation } from "./types";

type MutableReference<T> = {
  current: T;
};

type PendingCellMutations = {
  deletes: Set<string>;
  inserts: Map<string, Cell>;
  updates: Map<string, Cell>;
};

type UseTableRealtimeInput = {
  cellsRef: MutableReference<Cell[]>;
  mergeTable: (patch: Partial<TableInfo>) => void;
  onTableDeleted: () => void;
  programs: Program[];
  removeLocalColumn: (columnId: string) => void;
  removeLocalRow: (rowId: string) => void;
  selectedTableId: string;
  setCells: Dispatch<SetStateAction<Cell[]>>;
  upsertLocalCells: (cells: Cell[]) => void;
  upsertLocalColumn: (
    column: ReturnType<typeof normalizeBroadcastColumn>,
  ) => void;
  upsertLocalRow: (row: ReturnType<typeof normalizeBroadcastRow>) => void;
};

export const useTableRealtime = ({
  cellsRef,
  mergeTable,
  onTableDeleted,
  programs,
  removeLocalColumn,
  removeLocalRow,
  selectedTableId,
  setCells,
  upsertLocalCells,
  upsertLocalColumn,
  upsertLocalRow,
}: UseTableRealtimeInput) => {
  const pendingCellsRef = useRef<PendingCellMutations>({
    deletes: new Set<string>(),
    inserts: new Map<string, Cell>(),
    updates: new Map<string, Cell>(),
  });
  const cellFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const applyRunningCellMutation = (cell: Cell) => {
    const pending = pendingCellsRef.current;
    const currentCell = cellsRef.current.find(
      (current) => current.id === cell.id,
    );

    pending.inserts.delete(cell.id);
    pending.updates.delete(cell.id);
    upsertLocalCells([
      {
        ...cell,
        manualInput: currentCell?.manualInput ?? cell.manualInput,
        state: {
          ok: null,
        } as Cell["state"],
      },
    ]);
  };

  const queueSettledCellMutation = (cell: Cell) => {
    const existing = cellsRef.current.some((current) => current.id === cell.id);

    if (existing) {
      pendingCellsRef.current.updates.set(cell.id, cell);
    } else {
      pendingCellsRef.current.inserts.set(cell.id, cell);
    }
  };

  const flushCells = () => {
    const pending = pendingCellsRef.current;

    if (
      pending.inserts.size === 0 &&
      pending.updates.size === 0 &&
      pending.deletes.size === 0
    ) {
      return;
    }

    setCells((current) => {
      const next = [
        ...current,
      ];
      let changed = false;

      if (pending.deletes.size > 0) {
        const filtered = next.filter((cell) => !pending.deletes.has(cell.id));

        if (filtered.length !== next.length) {
          next.length = 0;
          next.push(...filtered);
          changed = true;
        }
      }

      if (pending.updates.size > 0) {
        for (let index = 0; index < next.length; index += 1) {
          const updated = pending.updates.get(next[index].id);

          if (updated) {
            next[index] = updated;
            changed = true;
          }
        }
      }

      if (pending.inserts.size > 0) {
        const existingIds = new Set(next.map((cell) => cell.id));

        for (const inserted of pending.inserts.values()) {
          if (!existingIds.has(inserted.id)) {
            next.push(inserted);
            changed = true;
          }
        }
      }

      pending.updates.clear();
      pending.inserts.clear();
      pending.deletes.clear();

      if (changed) {
        cellsRef.current = next;
      }

      return changed ? next : current;
    });
  };

  const queueCellMutation = (mutation: TableMutation) => {
    const pending = pendingCellsRef.current;

    if (mutation.type === "cell:delete") {
      pending.deletes.add(mutation.id);
    }

    if (mutation.type === "cell:upsert") {
      const cell = normalizeBroadcastCell(mutation.row);
      const state = getCellState(cell);

      if (isRunningCellState(state)) {
        applyRunningCellMutation(cell);
        return;
      }

      queueSettledCellMutation(cell);
    }

    if (cellFlushTimeoutRef.current) {
      return;
    }

    cellFlushTimeoutRef.current = setTimeout(() => {
      cellFlushTimeoutRef.current = null;
      flushCells();
    }, 100);
  };

  const applyTableMutation = (mutation: TableMutation) => {
    if (mutation.type.startsWith("cell:")) {
      queueCellMutation(mutation);
      return;
    }

    startTransition(() => {
      switch (mutation.type) {
        case "column:delete":
          removeLocalColumn(mutation.id);
          break;
        case "column:upsert":
          upsertLocalColumn(normalizeBroadcastColumn(mutation.row, programs));
          break;
        case "row:delete":
          removeLocalRow(mutation.id);
          break;
        case "row:upsert":
          upsertLocalRow(normalizeBroadcastRow(mutation.row));
          break;
        case "table:delete":
          onTableDeleted();
          break;
        case "table:upsert":
          mergeTable(normalizeBroadcastTablePatch(mutation.row));
          break;
      }
    });
  };

  usePrivateBroadcast({
    enabled: Boolean(selectedTableId),
    event: "table_mutation",
    label: "Table",
    onMessage: (mutation) => {
      if (isTableMutation(mutation)) {
        applyTableMutation(mutation);
      }
    },
    topic: selectedTableId ? `table:${selectedTableId}` : "table:",
  });

  useEffect(() => {
    pendingCellsRef.current.deletes.clear();
    pendingCellsRef.current.inserts.clear();
    pendingCellsRef.current.updates.clear();

    if (!selectedTableId) {
      return;
    }

    return () => {
      if (cellFlushTimeoutRef.current) {
        clearTimeout(cellFlushTimeoutRef.current);
        cellFlushTimeoutRef.current = null;
      }
    };
  }, [
    selectedTableId,
  ]);
};
