"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleSelectableTileVariants = cva(
  "group/selectable-tile relative flex w-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50",
  {
    compoundVariants: [
      {
        active: true,
        className:
          "border-orange-300 bg-orange-50/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
      },
      {
        active: false,
        className:
          "border-zinc-200 bg-white/90 hover:border-orange-200 hover:bg-orange-50/30",
      },
    ],
    defaultVariants: {
      active: false,
      shape: "square",
    },
    variants: {
      active: {
        false: "",
        true: "",
      },
      shape: {
        card: "flex-col items-center rounded-sm border px-3 py-3 text-center",
        square: "aspect-square items-center justify-center rounded-xs border",
        wide: "items-center gap-3 rounded-xs border px-3 py-2 text-left",
      },
    },
  },
);

export type MarbleSelectableTileProps =
  ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof marbleSelectableTileVariants>;

export function MarbleSelectableTile({
  active,
  children,
  className,
  shape,
  type = "button",
  ...props
}: MarbleSelectableTileProps) {
  return (
    <button
      aria-pressed={active ?? undefined}
      className={cx(
        marbleSelectableTileVariants({
          active,
          shape,
        }),
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
