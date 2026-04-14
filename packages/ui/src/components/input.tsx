import { cva, type VariantProps } from "class-variance-authority";
import type { InputHTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleInputRootVariants = cva(
  "relative flex bg-transparent transition-opacity border-b-2 border-b-neutral-300 focus-within:border-b-orange-600",
  {
    variants: {
      disabled: {
        false: "",
        true: "cursor-not-allowed opacity-50",
      },
    },
  },
);

const marbleInputVariants = cva(
  "w-full rounded-sm bg-white text-neutral-900 transition-colors placeholder-neutral-400 focus:bg-white focus:outline-none rounded-b-none border-t border-x border-neutral-200 ",
  {
    defaultVariants: {
      size: "md",
    },
    variants: {
      size: {
        md: "px-2 py-1.5 text-base",
        sm: "px-2 py-1.5 text-sm",
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
  disabled = false,
  size,
  wrapperClassName,
  ...props
}: MarbleInputProps) {
  return (
    <div
      className={cx(
        marbleInputRootVariants({
          disabled,
        }),
        "group/input",
        wrapperClassName,
      )}
    >
      <input
        className={cx(
          marbleInputVariants({
            size,
          }),
          className,
        )}
        disabled={disabled}
        {...props}
      />
    </div>
  );
}
