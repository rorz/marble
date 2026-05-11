"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "../utils/cx";

const marbleModalPanelVariants = cva(
  "w-full rounded-lg border border-zinc-200 bg-white shadow-xl outline-none",
  {
    defaultVariants: {
      size: "md",
    },
    variants: {
      size: {
        lg: "max-w-3xl",
        md: "max-w-xl",
        sm: "max-w-sm",
      },
    },
  },
);

const marbleModalHeaderVariants = cva(
  "flex shrink-0 items-center justify-between border-zinc-200 border-b px-5 py-3",
);
const marbleModalContentVariants = cva("px-5 py-4");
const marbleModalFooterVariants = cva(
  "flex items-center justify-end gap-2 border-zinc-200 border-t px-5 py-4",
);
const marbleModalTitleVariants = cva("font-semibold text-sm text-zinc-900");
const marbleModalDescriptionVariants = cva("text-sm text-zinc-600");

export type MarbleModalProps = {
  ariaDescribedBy?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
  onClose: () => void;
  panelClassName?: string;
} & VariantProps<typeof marbleModalPanelVariants>;

export function MarbleModal({
  ariaDescribedBy,
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
  onClose,
  panelClassName,
  size,
}: MarbleModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const handleClose = useEffectEvent(() => {
    onClose();
  });

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!portalTarget) {
      return;
    }

    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    portalTarget,
  ]);

  if (!portalTarget) {
    return null;
  }

  return createPortal(
    <div
      className={cx(
        "fixed inset-0 z-[1200] flex items-center justify-center p-4",
        className,
      )}
    >
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        type="button"
      />
      <div
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-modal="true"
        className={cx(
          marbleModalPanelVariants({
            size,
          }),
          "relative z-10",
          panelClassName,
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    portalTarget,
  );
}

export type MarbleModalHeaderProps = HTMLAttributes<HTMLDivElement>;

export function MarbleModalHeader({
  children,
  className,
  ...props
}: MarbleModalHeaderProps) {
  return (
    <div
      className={cx(marbleModalHeaderVariants(), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type MarbleModalContentProps = HTMLAttributes<HTMLDivElement>;

export function MarbleModalContent({
  children,
  className,
  ...props
}: MarbleModalContentProps) {
  return (
    <div
      className={cx(marbleModalContentVariants(), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type MarbleModalFooterProps = HTMLAttributes<HTMLDivElement>;

export function MarbleModalFooter({
  children,
  className,
  ...props
}: MarbleModalFooterProps) {
  return (
    <div
      className={cx(marbleModalFooterVariants(), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type MarbleModalTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function MarbleModalTitle({
  children,
  className,
  ...props
}: MarbleModalTitleProps) {
  return (
    <h3
      className={cx(marbleModalTitleVariants(), className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export type MarbleModalDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function MarbleModalDescription({
  children,
  className,
  ...props
}: MarbleModalDescriptionProps) {
  return (
    <p
      className={cx(marbleModalDescriptionVariants(), className)}
      {...props}
    >
      {children}
    </p>
  );
}

export type MarbleModalCloseProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function MarbleModalClose({
  children,
  className,
  type = "button",
  ...props
}: MarbleModalCloseProps) {
  return (
    <button
      aria-label="Close dialog"
      className={cx(
        "flex size-8 items-center justify-center rounded-sm text-taupe-400 transition-colors hover:bg-taupe-100 hover:text-taupe-900",
        className,
      )}
      type={type}
      {...props}
    >
      {children ?? (
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          viewBox="0 0 16 16"
        >
          <path
            d="M4 4L12 12M12 4L4 12"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </svg>
      )}
    </button>
  );
}
