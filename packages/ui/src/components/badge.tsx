import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleBadgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-1 font-medium",
  {
    compoundVariants: [
      {
        caps: true,
        className: "uppercase tracking-[0.18em]",
      },
    ],
    defaultVariants: {
      caps: false,
      size: "sm",
      tone: "neutral",
    },
    variants: {
      caps: {
        false: "tracking-normal",
        true: "",
      },
      size: {
        sm: "text-[11px]",
        xs: "text-[10px]",
      },
      tone: {
        error: "border-red-200 bg-red-50 text-red-700",
        info: "border-sky-200 bg-sky-50 text-sky-700",
        neutral: "border-zinc-200 bg-zinc-50 text-zinc-600",
        solid: "border-zinc-200 bg-white text-zinc-600",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-orange-200 bg-orange-50 text-orange-700",
      },
    },
  },
);

export type MarbleBadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof marbleBadgeVariants>;

export function MarbleBadge({
  caps,
  children,
  className,
  size,
  tone,
  ...props
}: MarbleBadgeProps) {
  return (
    <span
      className={cx(
        marbleBadgeVariants({
          caps,
          size,
          tone,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
