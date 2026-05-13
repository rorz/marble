import { cva } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleFieldLabelVariants = cva(
  "mb-1 block text-[10px] uppercase tracking-wider text-zinc-500",
);

export type MarbleFieldLabelProps = HTMLAttributes<HTMLSpanElement>;

export const MarbleFieldLabel = ({
  children,
  className,
  ...props
}: MarbleFieldLabelProps) => {
  return (
    <span
      className={cx(marbleFieldLabelVariants(), className)}
      {...props}
    >
      {children}
    </span>
  );
};
