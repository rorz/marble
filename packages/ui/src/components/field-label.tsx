import type { HTMLAttributes } from "react";
import { cx } from "../internal/cx";

export type MarbleFieldLabelProps = HTMLAttributes<HTMLSpanElement>;

export function MarbleFieldLabel({
  children,
  className,
  ...props
}: MarbleFieldLabelProps) {
  return (
    <span
      className={cx(
        "mb-1 block text-[10px] uppercase tracking-wider text-zinc-500",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
