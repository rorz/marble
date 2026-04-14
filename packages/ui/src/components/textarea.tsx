import type { TextareaHTMLAttributes } from "react";
import { cx } from "../internal/cx";
import {
  getMarbleTextareaClassName,
  type MarbleControlSize,
} from "../themes/control";

export type MarbleTextareaProps =
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    monospace?: boolean;
    size?: MarbleControlSize;
    wrapperClassName?: string;
  };

export function MarbleTextarea({
  className,
  monospace = false,
  size = "md",
  wrapperClassName,
  ...props
}: MarbleTextareaProps) {
  return (
    <div className={cx("relative flex", wrapperClassName)}>
      <textarea
        className={getMarbleTextareaClassName({
          className,
          monospace,
          size,
        })}
        {...props}
      />
    </div>
  );
}
