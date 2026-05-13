"use client";

import type { ReactNode } from "react";
import { MarbleButton, type MarbleButtonProps } from "./button";
import {
  MarbleModal,
  MarbleModalClose,
  MarbleModalContent,
  MarbleModalDescription,
  MarbleModalFooter,
  MarbleModalHeader,
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

export const MarbleConfirmModal = ({
  onClose,
  size = "sm",
  state,
}: MarbleConfirmModalProps) => {
  if (!state) {
    return null;
  }

  return (
    <MarbleModal
      ariaLabel={state.title}
      onClose={onClose}
      size={size}
    >
      <MarbleModalHeader>
        <MarbleModalTitle>{state.title}</MarbleModalTitle>
        <MarbleModalClose onClick={onClose} />
      </MarbleModalHeader>
      {state.message ? (
        <MarbleModalContent>
          <MarbleModalDescription>{state.message}</MarbleModalDescription>
        </MarbleModalContent>
      ) : null}
      <MarbleModalFooter>
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
};
