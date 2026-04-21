"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useId } from "react";
import { cx } from "../utils/cx";

type MarbleSheetContextValue = {
  descriptionId: string;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
  titleId: string;
};

const MarbleSheetContext = createContext<MarbleSheetContextValue | null>(null);

const marbleSheetContentSideClassNames = {
  bottom:
    "inset-x-1 bottom-1 max-h-[80%] rounded-t-md data-[state=closed]:translate-y-full data-[state=open]:translate-y-0",
  left: "inset-y-1 left-1 w-[min(30rem,calc(100%-0.5rem))] rounded-r-md data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0",
  right:
    "inset-y-1 right-1 w-[min(30rem,calc(100%-0.5rem))] rounded-l-md data-[state=closed]:translate-x-full data-[state=open]:translate-x-0",
  top: "inset-x-1 top-1 max-h-[80%] rounded-b-md data-[state=closed]:-translate-y-full data-[state=open]:translate-y-0",
} as const;

function useMarbleSheetContext() {
  const context = useContext(MarbleSheetContext);

  if (!context) {
    throw new Error("MarbleSheet components must be used inside MarbleSheet.");
  }

  return context;
}

export type MarbleSheetProps = {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
};

export function MarbleSheet({
  children,
  onOpenChange,
  open,
}: MarbleSheetProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <MarbleSheetContext.Provider
      value={{
        descriptionId,
        onOpenChange,
        open,
        titleId,
      }}
    >
      {children}
    </MarbleSheetContext.Provider>
  );
}

export type MarbleSheetCloseProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function MarbleSheetClose({
  children,
  className,
  onClick,
  type = "button",
  ...props
}: MarbleSheetCloseProps) {
  const { onOpenChange } = useMarbleSheetContext();

  return (
    <button
      className={cx(
        "flex size-8 items-center justify-center rounded-sm text-taupe-400 transition-colors hover:bg-taupe-100 hover:text-taupe-900",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          onOpenChange?.(false);
        }
      }}
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
      <span className="sr-only">Close sheet</span>
    </button>
  );
}

export type MarbleSheetContentProps = HTMLAttributes<HTMLDivElement> & {
  backdropClassName?: string;
  showBackdrop?: boolean;
  showCloseButton?: boolean;
  side?: keyof typeof marbleSheetContentSideClassNames;
};

export function MarbleSheetContent({
  backdropClassName,
  children,
  className,
  showBackdrop = true,
  showCloseButton = true,
  side = "right",
  ...props
}: MarbleSheetContentProps) {
  const { descriptionId, onOpenChange, open, titleId } =
    useMarbleSheetContext();
  const state = open ? "open" : "closed";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {showBackdrop ? (
        <button
          aria-hidden={!open}
          className={cx(
            "absolute inset-0 bg-taupe-950/40 backdrop-blur-xs transition-opacity duration-200 ease-out",
            open ? "pointer-events-auto opacity-100" : "opacity-0",
            backdropClassName,
          )}
          onClick={() => onOpenChange?.(false)}
          tabIndex={open ? 0 : -1}
          type="button"
        />
      ) : null}

      <div
        aria-describedby={descriptionId}
        aria-hidden={!open}
        aria-labelledby={titleId}
        aria-modal={showBackdrop || undefined}
        className={cx(
          "pointer-events-auto absolute z-10 flex min-h-0 flex-col overflow-hidden border border-taupe-200 bg-linear-to-b from-white via-white to-taupe-50 shadow-[0_18px_48px_rgba(84,57,26,0.16)] outline-none transition-[transform,opacity] duration-200 ease-out data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
          marbleSheetContentSideClassNames[side],
          className,
        )}
        data-state={state}
        role="dialog"
        tabIndex={-1}
        {...props}
      >
        {showCloseButton && onOpenChange ? (
          <MarbleSheetClose className="absolute top-3 right-3 z-10" />
        ) : null}
        {children}
      </div>
    </div>
  );
}

export type MarbleSheetHeaderProps = HTMLAttributes<HTMLDivElement>;

export function MarbleSheetHeader({
  children,
  className,
  ...props
}: MarbleSheetHeaderProps) {
  return (
    <div
      className={cx(
        "flex shrink-0 flex-col gap-1 border-b border-taupe-200 bg-linear-to-r from-taupe-50 via-white to-white px-5 py-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type MarbleSheetFooterProps = HTMLAttributes<HTMLDivElement>;

export function MarbleSheetFooter({
  children,
  className,
  ...props
}: MarbleSheetFooterProps) {
  return (
    <div
      className={cx(
        "flex shrink-0 items-center justify-end gap-2 border-t border-taupe-200 bg-linear-to-t from-taupe-100 via-white to-white px-5 py-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type MarbleSheetTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function MarbleSheetTitle({
  children,
  className,
  ...props
}: MarbleSheetTitleProps) {
  const { titleId } = useMarbleSheetContext();

  return (
    <h2
      className={cx("pr-8 font-semibold text-base text-taupe-950", className)}
      id={titleId}
      {...props}
    >
      {children}
    </h2>
  );
}

export type MarbleSheetDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function MarbleSheetDescription({
  children,
  className,
  ...props
}: MarbleSheetDescriptionProps) {
  const { descriptionId } = useMarbleSheetContext();

  return (
    <p
      className={cx("text-sm text-taupe-600", className)}
      id={descriptionId}
      {...props}
    >
      {children}
    </p>
  );
}
