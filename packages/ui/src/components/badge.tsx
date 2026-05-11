import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleBadgeVariants = cva(
  "place-self-start inline-flex items-center rounded-xs border px-1.5 py-0.5 font-semibold",
  {
    defaultVariants: {
      caps: false,
      tone: "neutral",
    },
    variants: {
      caps: {
        false: "tracking-wide text-[11px]",
        true: "text-eyebrow-xs",
      },
      tone: {
        error: "border-red-100 bg-red-100/50 text-red-500",
        info: "border-cyan-100 bg-cyan-100/50 text-cyan-600",
        neutral: "border-taupe-200 bg-taupe-200/50 text-taupe-500",
        solid: "border-taupe-700 bg-taupe-700 text-taupe-50",
        success: "border-green-200 bg-green-50 text-green-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
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
  tone,
  ...props
}: MarbleBadgeProps) {
  return (
    <span
      className={cx(
        marbleBadgeVariants({
          caps,
          tone,
        }),
        className,
      )}
      {...props}
    >
      <span>{children}</span>
    </span>
  );
}
