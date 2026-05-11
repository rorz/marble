import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";
import { MarbleFieldLabel } from "./field-label";

export type MarbleFieldProps = HTMLAttributes<HTMLDivElement> & {
  description?: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
  labelClassName?: string;
};

export function MarbleField({
  children,
  className,
  description,
  hint,
  label,
  labelClassName,
  ...props
}: MarbleFieldProps) {
  return (
    <div
      className={cx("space-y-1.5", className)}
      {...props}
    >
      <MarbleFieldLabel className={labelClassName}>{label}</MarbleFieldLabel>
      {children}
      {description ? (
        <p className="text-xs text-taupe-500">{description}</p>
      ) : null}
      {hint ? <p className="text-xs text-taupe-500">{hint}</p> : null}
    </div>
  );
}
