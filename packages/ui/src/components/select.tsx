import { cva, type VariantProps } from "class-variance-authority";
import type { SelectHTMLAttributes } from "react";
import { cx } from "../utils/cx";

export const marbleSelectVariants = cva(
  "w-full appearance-none cursor-pointer rounded-md border-x border-t border-b-2 border-neutral-200 border-b-neutral-300 bg-white pr-8 text-neutral-900 shadow-sm transition-colors focus:border-b-orange-400 focus:outline-none",
  {
    variants: {
      size: {
        md: "px-3 py-1.5 text-sm",
        sm: "px-2.5 py-1.5 text-sm",
        xs: "px-2 py-1 text-xs",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type MarbleSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size"
> &
  VariantProps<typeof marbleSelectVariants> & {
    wrapperClassName?: string;
  };

export function MarbleSelect({
  children,
  className,
  size,
  wrapperClassName,
  ...props
}: MarbleSelectProps) {
  return (
    <div className={cx("relative inline-flex", wrapperClassName)}>
      <select
        className={cx(
          marbleSelectVariants({
            size,
          }),
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
        <svg
          aria-hidden="true"
          className="size-4 fill-current"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9.293 12.95 10 13.657 15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  );
}
