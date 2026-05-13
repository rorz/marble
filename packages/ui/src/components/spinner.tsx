import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleSpinnerVariants = cva(
  "inline-block animate-spin rounded-full border-current border-t-transparent align-[-0.125em]",
  {
    defaultVariants: {
      size: "md",
      tone: "neutral",
    },
    variants: {
      size: {
        lg: "size-6 border-2",
        md: "size-4 border-2",
        sm: "size-3 border-2",
        xs: "size-2.5 border-[1.5px]",
      },
      tone: {
        neutral: "text-zinc-500",
        orange: "text-orange-500",
        subtle: "text-zinc-400",
        white: "text-white",
      },
    },
  },
);

export type MarbleSpinnerProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof marbleSpinnerVariants> & {
    label?: string;
  };

export function MarbleSpinner({
  className,
  label = "Loading",
  size,
  tone,
  ...props
}: MarbleSpinnerProps) {
  return (
    <span
      aria-label={label}
      className={cx(
        marbleSpinnerVariants({
          size,
          tone,
        }),
        className,
      )}
      role="status"
      {...props}
    />
  );
}
