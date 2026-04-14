import type { InputHTMLAttributes } from "react";
import { cx } from "../internal/cx";
import {
  getMarbleInputClassName,
  type MarbleControlSize,
} from "../themes/control";

export type MarbleInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  size?: MarbleControlSize;
  wrapperClassName?: string;
};

export function MarbleInput({
  className,
  size = "md",
  wrapperClassName,
  ...props
}: MarbleInputProps) {
  return (
    <div className={cx("relative flex", wrapperClassName)}>
      <input
        className={getMarbleInputClassName({
          className,
          size,
        })}
        {...props}
      />
    </div>
  );
}
