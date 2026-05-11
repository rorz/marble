import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleAlertVariants = cva("rounded-xs border", {
  defaultVariants: {
    size: "md",
    tone: "neutral",
  },
  variants: {
    size: {
      md: "px-4 py-3 text-sm",
      sm: "px-2.5 py-1.5 text-xs",
    },
    tone: {
      error: "border-red-200 bg-red-50 text-red-700",
      info: "border-cyan-200 bg-cyan-50 text-cyan-700",
      neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
      success: "border-emerald-200 bg-emerald-50 text-emerald-700",
      warning: "border-orange-200 bg-orange-50 text-orange-600",
    },
  },
});

export type MarbleAlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof marbleAlertVariants>;

export function MarbleAlert({
  children,
  className,
  size,
  tone,
  ...props
}: MarbleAlertProps) {
  return (
    <div
      className={cx(
        marbleAlertVariants({
          size,
          tone,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
