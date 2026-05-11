"use client";

import type { ReactNode } from "react";
import { MarbleButton, type MarbleButtonProps } from "./button";
import {
  MarbleModal,
  MarbleModalContent,
  MarbleModalFooter,
  type MarbleModalProps,
  MarbleModalTitle,
} from "./modal";

export type MarbleConfirmModalState = {
  cancelLabel?: string;
  confirmLabel: string;
  confirmVariant?: MarbleButtonProps["variant"];
  message?: ReactNode;
  onConfirm: () => void;
  title: string;
};

export type MarbleConfirmModalProps = {
  onClose: () => void;
  size?: MarbleModalProps["size"];
  state: MarbleConfirmModalState | null;
};

export function MarbleConfirmModal({
  onClose,
  size = "sm",
  state,
}: MarbleConfirmModalProps) {
  if (!state) {
    return null;
  }

  return (
    <MarbleModal
      ariaLabel={state.title}
      onClose={onClose}
      size={size}
    >
      <MarbleModalContent className="space-y-2 pb-5 pt-5">
        <MarbleModalTitle>{state.title}</MarbleModalTitle>
        {state.message ? (
          <p className="text-sm text-zinc-600">{state.message}</p>
        ) : null}
      </MarbleModalContent>
      <MarbleModalFooter className="border-t-0 pt-0">
        <MarbleButton onClick={onClose}>
          {state.cancelLabel ?? "Cancel"}
        </MarbleButton>
        <MarbleButton
          onClick={() => {
            state.onConfirm();
            onClose();
          }}
          variant={state.confirmVariant ?? "red"}
        >
          {state.confirmLabel}
        </MarbleButton>
      </MarbleModalFooter>
    </MarbleModal>
  );
}
