"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
} from "react";
import { cx } from "../utils/cx";

const marbleSheetContentSideClassNames = {
  bottom:
    "inset-x-1 bottom-1 max-h-[80%] rounded-t-md data-[state=closed]:translate-y-full data-[state=open]:translate-y-0",
  left: "inset-y-1 left-1 w-[min(30rem,calc(100%-0.5rem))] rounded-r-md data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0",
  right:
    "inset-y-1 right-1 w-[min(30rem,calc(100%-0.5rem))] rounded-l-md data-[state=closed]:translate-x-full data-[state=open]:translate-x-0",
  top: "inset-x-1 top-1 max-h-[80%] rounded-b-md data-[state=closed]:-translate-y-full data-[state=open]:translate-y-0",
} as const;

export type MarbleSheetProps = ComponentProps<typeof DialogPrimitive.Root>;

export const MarbleSheet = ({ children, ...props }: MarbleSheetProps) => {
  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>;
};

type MarbleSheetCloseVariant = "button" | "icon";

type MarbleSheetCloseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: MarbleSheetCloseVariant;
};

const marbleSheetCloseVariantClassName: Record<
  MarbleSheetCloseVariant,
  string
> = {
  button:
    "h-auto w-auto rounded-xs border border-taupe-200 px-3 py-1.5 text-sm text-taupe-700 hover:bg-taupe-100 hover:text-taupe-900",
  icon: "flex size-8 items-center justify-center rounded-sm text-taupe-400 hover:bg-taupe-100 hover:text-taupe-900",
};

export const MarbleSheetClose = ({
  children,
  className,
  type = "button",
  variant = "icon",
  ...props
}: MarbleSheetCloseProps) => {
  return (
    <DialogPrimitive.Close asChild>
      <button
        className={cx(
          "transition-colors",
          marbleSheetCloseVariantClassName[variant],
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
        {variant === "icon" && !children ? (
          <span className="sr-only">Close sheet</span>
        ) : null}
      </button>
    </DialogPrimitive.Close>
  );
};

export type MarbleSheetContentProps = ComponentProps<
  typeof DialogPrimitive.Content
> & {
  backdropClassName?: string;
  showBackdrop?: boolean;
  showCloseButton?: boolean;
  side?: keyof typeof marbleSheetContentSideClassNames;
};

export const MarbleSheetContent = ({
  backdropClassName,
  children,
  className,
  forceMount,
  showBackdrop = true,
  showCloseButton = true,
  side = "right",
  ...props
}: MarbleSheetContentProps) => {
  return (
    <DialogPrimitive.Portal
      {...(forceMount
        ? {
            forceMount: true,
          }
        : {})}
    >
      {showBackdrop ? (
        <DialogPrimitive.Overlay
          className={cx(
            "fixed inset-0 z-[1100] bg-taupe-950/40 backdrop-blur-xs transition-opacity duration-200 ease-out data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-reduce:transition-none",
            backdropClassName,
          )}
          {...(forceMount
            ? {
                forceMount: true,
              }
            : {})}
        />
      ) : null}

      <DialogPrimitive.Content
        className={cx(
          "fixed z-[1101] flex min-h-0 flex-col overflow-hidden border border-taupe-200 bg-linear-to-b from-white via-white to-taupe-50 shadow-[0_18px_48px_rgba(84,57,26,0.16)] outline-none transition-[transform,opacity] duration-200 ease-out data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-reduce:transition-none",
          marbleSheetContentSideClassNames[side],
          className,
        )}
        {...(forceMount
          ? {
              forceMount: true,
            }
          : {})}
        {...props}
      >
        {showCloseButton ? (
          <MarbleSheetClose className="absolute top-3 right-3 z-10" />
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

export type MarbleSheetHeaderProps = HTMLAttributes<HTMLDivElement>;

export const MarbleSheetHeader = ({
  children,
  className,
  ...props
}: MarbleSheetHeaderProps) => {
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
};

export type MarbleSheetFooterProps = HTMLAttributes<HTMLDivElement>;

export const MarbleSheetFooter = ({
  children,
  className,
  ...props
}: MarbleSheetFooterProps) => {
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
};

export type MarbleSheetTitleProps = HTMLAttributes<HTMLHeadingElement>;

export const MarbleSheetTitle = ({
  children,
  className,
  ...props
}: MarbleSheetTitleProps) => {
  return (
    <DialogPrimitive.Title
      className={cx("pr-8 font-semibold text-base text-taupe-950", className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Title>
  );
};

export type MarbleSheetDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const MarbleSheetDescription = ({
  children,
  className,
  ...props
}: MarbleSheetDescriptionProps) => {
  return (
    <DialogPrimitive.Description
      className={cx("text-sm text-taupe-600", className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Description>
  );
};
