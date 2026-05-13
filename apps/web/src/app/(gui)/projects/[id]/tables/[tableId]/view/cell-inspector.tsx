"use client";

import {
  MarbleJsonPreview,
  MarbleModal,
  MarbleModalClose,
  MarbleModalContent,
  MarbleModalHeader,
  MarbleModalTitle,
} from "@marble/ui";
import type { InspectedCell } from "./types";

export const CellInspectorModal = ({
  cell,
  onClose,
}: {
  cell: InspectedCell;
  onClose: () => void;
}) => {
  const { state } = cell;

  return (
    <MarbleModal
      ariaLabel={`${cell.columnName} row ${cell.rowIndex}`}
      onClose={onClose}
      panelClassName="flex max-h-[80vh] flex-col"
    >
      <MarbleModalHeader>
        <div>
          <MarbleModalTitle>
            {cell.columnName}
            <span className="ml-2 font-normal text-zinc-400">
              Row {cell.rowIndex}
            </span>
          </MarbleModalTitle>
          {state?.ok === false && (
            <span className="font-medium text-red-500 text-xs">Error</span>
          )}
          {state?.ok === true && (
            <span className="font-medium text-emerald-600 text-xs">
              Success
            </span>
          )}
          {state?.ok === null && (
            <span className="font-medium text-xs text-zinc-400">Loading</span>
          )}
          {state === null && (
            <span className="font-medium text-xs text-zinc-400">Not run</span>
          )}
        </div>
        <MarbleModalClose onClick={onClose} />
      </MarbleModalHeader>
      <MarbleModalContent className="flex-1 overflow-auto">
        <div className="space-y-4">
          {cell.manualInput !== null && (
            <div className="mb-4">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                Manual Input
              </div>
              <div className="rounded-xs border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm">
                {cell.manualInput || (
                  <span className="text-zinc-300">empty</span>
                )}
              </div>
            </div>
          )}

          <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
            Cell State
          </div>
          {state === null ? (
            <div className="text-sm italic text-zinc-400">
              No state — cell has not been run yet.
            </div>
          ) : (
            <MarbleJsonPreview value={state} />
          )}
        </div>
      </MarbleModalContent>
    </MarbleModal>
  );
};
