import type { SelectHTMLAttributes } from "react";
import { cx } from "../internal/cx";
import {
  getMarbleSelectClassName,
  type MarbleControlSize,
} from "../themes/control";

export type MarbleSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size"
> & {
  size?: MarbleControlSize;
  wrapperClassName?: string;
};

export function MarbleSelect({
  children,
  className,
  size = "md",
  wrapperClassName,
  ...props
}: MarbleSelectProps) {
  return (
    <div className={cx("relative inline-flex", wrapperClassName)}>
      <select
        className={getMarbleSelectClassName({
          className,
          size,
        })}
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
