import { cva } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

const marbleEmptyStateIconTileVariants = cva(
  "flex size-10 items-center justify-center rounded-xs border",
  {
    defaultVariants: {
      iconTone: "neutral",
    },
    variants: {
      iconTone: {
        neutral: "border-taupe-200 bg-white text-taupe-700",
        orange: "border-orange-200 bg-orange-50 text-orange-700",
      },
    },
  },
);

type MarbleEmptyStateIconTone = "neutral" | "orange";

export type MarbleEmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  iconTone?: MarbleEmptyStateIconTone;
  title: ReactNode;
};

export const MarbleEmptyState = ({
  actions,
  className,
  description,
  icon,
  iconTone,
  title,
  ...props
}: MarbleEmptyStateProps) => {
  const renderedIcon = icon ? (
    iconTone ? (
      <div
        className={marbleEmptyStateIconTileVariants({
          iconTone,
        })}
      >
        {icon}
      </div>
    ) : (
      icon
    )
  ) : null;

  return (
    <div
      className={cx("py-10 text-center", className)}
      {...props}
    >
      {renderedIcon ? (
        <div className="mb-4 flex justify-center">{renderedIcon}</div>
      ) : null}
      <p className="font-medium text-sm text-zinc-950">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      ) : null}
      {actions ? <div className="mt-4">{actions}</div> : null}
    </div>
  );
};
