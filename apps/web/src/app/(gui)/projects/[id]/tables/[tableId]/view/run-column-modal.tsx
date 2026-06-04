import {
  MarbleButton,
  MarbleField,
  MarbleInput,
  MarbleModal,
  MarbleModalClose,
  MarbleModalContent,
  MarbleModalDescription,
  MarbleModalFooter,
  MarbleModalHeader,
  MarbleModalTitle,
} from "@marble/ui";
import { useState } from "react";

import type { RunColumnCountModalState } from "./types";

const clampCount = (raw: number, maxRows: number) => {
  if (!Number.isFinite(raw)) {
    return 1;
  }

  const rounded = Math.floor(raw);
  if (rounded < 1) {
    return 1;
  }

  if (maxRows > 0 && rounded > maxRows) {
    return maxRows;
  }

  return rounded;
};

export const RunColumnModal = ({
  onClose,
  onConfirm,
  state,
}: Readonly<{
  onClose: () => void;
  onConfirm: (columnId: string, count: number) => void;
  state: RunColumnCountModalState;
}>) => {
  const [value, setValue] = useState("1");

  if (!state) {
    return null;
  }

  const handleSubmit = () => {
    const count = clampCount(Number.parseInt(value, 10), state.maxRows);
    onConfirm(state.columnId, count);
    onClose();
  };

  return (
    <MarbleModal
      ariaLabel={`Run cells in ${state.columnName}`}
      onClose={onClose}
      size="sm"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <MarbleModalHeader>
          <MarbleModalTitle>Run column</MarbleModalTitle>
          <MarbleModalClose onClick={onClose} />
        </MarbleModalHeader>
        <MarbleModalContent className="space-y-4">
          <MarbleModalDescription>
            Run the first N cells of "{state.columnName}" from the top.
            {state.maxRows > 0
              ? ` This column has ${state.maxRows} ${
                  state.maxRows === 1 ? "row" : "rows"
                }.`
              : null}
          </MarbleModalDescription>

          <MarbleField label="Number of cells">
            <MarbleInput
              aria-label="Number of cells to run"
              autoFocus
              min={1}
              onChange={(event) => setValue(event.target.value)}
              size="sm"
              type="number"
              value={value}
              wrapperClassName="w-full"
            />
          </MarbleField>
        </MarbleModalContent>
        <MarbleModalFooter>
          <MarbleButton
            onClick={onClose}
            size="sm"
            type="button"
          >
            Cancel
          </MarbleButton>
          <MarbleButton
            size="sm"
            type="submit"
            variant="orange"
          >
            Run
          </MarbleButton>
        </MarbleModalFooter>
      </form>
    </MarbleModal>
  );
};
