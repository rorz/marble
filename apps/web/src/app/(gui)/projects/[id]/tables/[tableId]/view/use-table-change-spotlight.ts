import type { AgGridReact } from "ag-grid-react";
import type { RefObject } from "react";

import {
  type ChangeTargetDescriptor,
  changeTargetKey,
  useChangeSpotlightResolver,
} from "../../../../../change-spotlight";

import { escapeChangeTargetSelector } from "./interpolation-editor";
import type { Column, Row } from "./types";

type UseTableChangeSpotlightInput = {
  columnsRef: RefObject<Column[]>;
  gridRef: RefObject<AgGridReact | null>;
  rowsRef: RefObject<Row[]>;
  selectedTableId: string;
};

export const useTableChangeSpotlight = ({
  columnsRef,
  gridRef,
  rowsRef,
  selectedTableId,
}: UseTableChangeSpotlightInput) => {
  const matchChangeTarget = (descriptor: ChangeTargetDescriptor) => {
    if (descriptor.kind === "table" && descriptor.tableId === selectedTableId) {
      return true;
    }

    if (descriptor.kind === "row") {
      return rowsRef.current.some((row) => row.id === descriptor.rowId);
    }

    if (descriptor.kind === "column") {
      return columnsRef.current.some(
        (column) => column.id === descriptor.columnId,
      );
    }

    if (descriptor.kind === "cell") {
      return (
        rowsRef.current.some((row) => row.id === descriptor.rowId) &&
        columnsRef.current.some((column) => column.id === descriptor.columnId)
      );
    }

    return false;
  };

  const revealChangeTarget = (descriptor: ChangeTargetDescriptor) => {
    const api = gridRef.current?.api;

    if (!api || descriptor.kind === "table") {
      return descriptor.kind === "table";
    }

    const flashAfterReveal = (columnsToFlash: string[], rowId?: string) => {
      window.requestAnimationFrame(() => {
        const nextApi = gridRef.current?.api;

        if (!nextApi || columnsToFlash.length === 0) {
          return;
        }

        nextApi.flashCells({
          columns: columnsToFlash,
          rowNodes: rowId
            ? [
                nextApi.getRowNode(rowId),
              ].filter(
                (rowNode): rowNode is NonNullable<typeof rowNode> =>
                  rowNode !== undefined && rowNode !== null,
              )
            : undefined,
        });
      });
    };

    if (descriptor.kind === "row") {
      const rowIndex = rowsRef.current.findIndex(
        (row) => row.id === descriptor.rowId,
      );

      if (rowIndex < 0) {
        return false;
      }

      api.ensureIndexVisible(rowIndex);
      flashAfterReveal(
        columnsRef.current
          .slice(0, Math.min(6, columnsRef.current.length))
          .map((column) => column.id),
        descriptor.rowId,
      );
      return true;
    }

    if (descriptor.kind === "column") {
      if (
        !columnsRef.current.some((column) => column.id === descriptor.columnId)
      ) {
        return false;
      }

      api.ensureColumnVisible(descriptor.columnId);
      flashAfterReveal([
        descriptor.columnId,
      ]);
      return true;
    }

    if (descriptor.kind === "cell") {
      const rowIndex = rowsRef.current.findIndex(
        (row) => row.id === descriptor.rowId,
      );

      if (
        rowIndex < 0 ||
        !columnsRef.current.some((column) => column.id === descriptor.columnId)
      ) {
        return false;
      }

      api.ensureIndexVisible(rowIndex);
      api.ensureColumnVisible(descriptor.columnId);
      flashAfterReveal(
        [
          descriptor.columnId,
        ],
        descriptor.rowId,
      );
      return true;
    }

    return false;
  };

  const findChangeTarget = (descriptor: ChangeTargetDescriptor) => {
    if (typeof document === "undefined") {
      return null;
    }

    const targetKey =
      descriptor.kind === "table"
        ? changeTargetKey.table(descriptor.tableId)
        : descriptor.kind === "row"
          ? changeTargetKey.row(descriptor.rowId)
          : descriptor.kind === "column"
            ? changeTargetKey.column(descriptor.columnId)
            : descriptor.kind === "cell"
              ? changeTargetKey.cell(descriptor.rowId, descriptor.columnId)
              : null;

    if (!targetKey) {
      return null;
    }

    const targetElement = document.querySelector<HTMLElement>(
      `[data-change-target="${escapeChangeTargetSelector(targetKey)}"]`,
    );

    if (!targetElement) {
      return null;
    }

    if (descriptor.kind === "column") {
      return (
        targetElement.closest<HTMLElement>(".ag-header-cell") ?? targetElement
      );
    }

    if (descriptor.kind === "row" || descriptor.kind === "cell") {
      return targetElement.closest<HTMLElement>(".ag-cell") ?? targetElement;
    }

    return targetElement;
  };

  useChangeSpotlightResolver({
    findElement: findChangeTarget,
    match: matchChangeTarget,
    reveal: revealChangeTarget,
  });
};
