import { cva, type VariantProps } from "class-variance-authority";
import type { TextareaHTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleTextareaVariants = cva(
  "w-full resize-y rounded-md border-x border-t border-b-2 border-neutral-200 border-b-neutral-300 bg-white text-neutral-900 shadow-sm transition-colors placeholder-neutral-400 focus:border-b-orange-400 focus:outline-none",
  {
    defaultVariants: {
      monospace: false,
      size: "md",
    },
    variants: {
      monospace: {
        false: "",
        true: "font-mono",
      },
      size: {
        md: "px-3 py-1.5 text-sm",
        sm: "px-2.5 py-1.5 text-sm",
        xs: "px-2 py-1 text-xs",
      },
    },
  },
);

export type MarbleTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  VariantProps<typeof marbleTextareaVariants> & {
    wrapperClassName?: string;
  };

export const MarbleTextarea = ({
  className,
  monospace,
  size,
  wrapperClassName,
  ...props
}: MarbleTextareaProps) => {
  return (
    <div className={cx("relative flex", wrapperClassName)}>
      <textarea
        className={cx(
          marbleTextareaVariants({
            monospace,
            size,
          }),
          className,
        )}
        {...props}
      />
    </div>
  );
};
