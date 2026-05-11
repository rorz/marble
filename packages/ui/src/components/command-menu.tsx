"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import type { ComponentProps } from "react";
import { cx } from "../utils/cx";

const marbleCommandRootBaseClassName =
  "flex h-full w-full flex-col overflow-hidden bg-white text-taupe-900 inset-shadow-2xs inset-shadow-white/90";

const marbleCommandRootClassName = cx(
  marbleCommandRootBaseClassName,
  "rounded-xs border border-taupe-200",
);

const marbleCommandEmbeddedClassName = cx(
  marbleCommandRootBaseClassName,
  "border-y border-taupe-200",
);

export type MarbleCommandMenuProps = ComponentProps<typeof CommandPrimitive> & {
  embedded?: boolean;
};

export function MarbleCommandMenu({
  className,
  embedded = false,
  ...props
}: MarbleCommandMenuProps) {
  return (
    <CommandPrimitive
      className={cx(
        embedded ? marbleCommandEmbeddedClassName : marbleCommandRootClassName,
        className,
      )}
      {...props}
    />
  );
}

export type MarbleCommandDialogProps = ComponentProps<
  typeof CommandPrimitive.Dialog
>;

export function MarbleCommandDialog({
  className,
  contentClassName,
  label,
  overlayClassName,
  ...props
}: MarbleCommandDialogProps) {
  return (
    <CommandPrimitive.Dialog
      className={cx(
        marbleCommandRootClassName,
        "h-[min(32rem,70vh)] shadow-2xl",
        className,
      )}
      contentClassName={cx(
        "fixed inset-x-0 top-[12vh] z-50 mx-auto w-[min(42rem,calc(100vw-1.5rem))] outline-none",
        contentClassName,
      )}
      label={label}
      overlayClassName={cx(
        "fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-[2px]",
        overlayClassName,
      )}
      {...props}
    >
      <RadixDialog.Title className="sr-only">
        {label ?? "Command menu"}
      </RadixDialog.Title>
      {props.children}
    </CommandPrimitive.Dialog>
  );
}

export type MarbleCommandInputProps = ComponentProps<
  typeof CommandPrimitive.Input
> & {
  wrapperClassName?: string;
};

export function MarbleCommandInput({
  className,
  wrapperClassName,
  ...props
}: MarbleCommandInputProps) {
  return (
    <div
      className={cx(
        "border-b border-taupe-200 bg-linear-to-r from-taupe-50 via-white to-white px-3 py-2",
        wrapperClassName,
      )}
    >
      <CommandPrimitive.Input
        className={cx(
          "h-10 w-full border-none bg-transparent text-sm text-taupe-900 outline-none placeholder:text-taupe-500",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export type MarbleCommandListProps = ComponentProps<
  typeof CommandPrimitive.List
>;

export function MarbleCommandList({
  className,
  ...props
}: MarbleCommandListProps) {
  return (
    <CommandPrimitive.List
      className={cx(
        "min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 scroll-py-2",
        className,
      )}
      {...props}
    />
  );
}

export type MarbleCommandEmptyProps = ComponentProps<
  typeof CommandPrimitive.Empty
>;

export function MarbleCommandEmpty({
  className,
  ...props
}: MarbleCommandEmptyProps) {
  return (
    <CommandPrimitive.Empty
      className={cx("px-4 py-10 text-center text-sm text-taupe-500", className)}
      {...props}
    />
  );
}

export type MarbleCommandGroupProps = ComponentProps<
  typeof CommandPrimitive.Group
>;

export function MarbleCommandGroup({
  className,
  ...props
}: MarbleCommandGroupProps) {
  return (
    <CommandPrimitive.Group
      className={cx(
        "overflow-hidden p-1 text-taupe-800 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-eyebrow [&_[cmdk-group-heading]]:text-taupe-500",
        className,
      )}
      {...props}
    />
  );
}

export type MarbleCommandItemProps = ComponentProps<
  typeof CommandPrimitive.Item
>;

export function MarbleCommandItem({
  className,
  ...props
}: MarbleCommandItemProps) {
  return (
    <CommandPrimitive.Item
      className={cx(
        "flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2 text-sm text-taupe-800 outline-none transition-colors hover:bg-taupe-100/80 hover:text-taupe-950 [&[aria-disabled='true']]:pointer-events-none [&[aria-disabled='true']]:cursor-not-allowed [&[aria-disabled='true']]:opacity-40 [&[aria-selected='true']]:bg-orange-50 [&[aria-selected='true']]:text-orange-950",
        className,
      )}
      {...props}
    />
  );
}

export type MarbleCommandSeparatorProps = ComponentProps<
  typeof CommandPrimitive.Separator
>;

export function MarbleCommandSeparator({
  className,
  ...props
}: MarbleCommandSeparatorProps) {
  return (
    <CommandPrimitive.Separator
      className={cx("-mx-1 my-1 h-px bg-taupe-200", className)}
      {...props}
    />
  );
}
