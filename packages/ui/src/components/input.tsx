import { cva, type VariantProps } from "class-variance-authority";
import type { InputHTMLAttributes } from "react";
import { cx } from "../utils/cx";

export const marbleInputVariants = cva(
  "w-full rounded-md border-x border-t border-b-2 border-neutral-200 border-b-neutral-300 bg-white text-neutral-900 shadow-sm transition-colors placeholder-neutral-400 focus:border-b-orange-400 focus:outline-none",
  {
    defaultVariants: {
      size: "md",
    },
    variants: {
      size: {
        md: "px-3 py-1.5 text-sm",
        sm: "px-2.5 py-1.5 text-sm",
        xs: "px-2 py-1 text-xs",
      },
    },
  },
);

export type MarbleInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> &
  VariantProps<typeof marbleInputVariants> & {
    wrapperClassName?: string;
  };

export function MarbleInput({
  className,
  size,
  wrapperClassName,
  ...props
}: MarbleInputProps) {
  return (
    <div className={cx("relative flex", wrapperClassName)}>
      <input
        className={cx(
          marbleInputVariants({
            size,
          }),
          className,
        )}
        {...props}
      />
    </div>
  );
}
