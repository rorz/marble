import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

export type MarbleEmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
};

export function MarbleEmptyState({
  actions,
  className,
  description,
  icon,
  title,
  ...props
}: MarbleEmptyStateProps) {
  return (
    <div
      className={cx("py-10 text-center", className)}
      {...props}
    >
      {icon ? <div className="mb-4 flex justify-center">{icon}</div> : null}
      <p className="font-medium text-sm text-zinc-950">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      ) : null}
      {actions ? <div className="mt-4">{actions}</div> : null}
    </div>
  );
}
