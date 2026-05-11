import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

const marbleListRowWrapperVariants = cva(
  "flex items-stretch gap-3 border-b last:border-b-0",
  {
    defaultVariants: {
      tone: "neutral",
    },
    variants: {
      tone: {
        neutral: "border-zinc-200",
        orange: "border-orange-100",
      },
    },
  },
);

const marbleListRowButtonVariants = cva(
  "flex min-w-0 flex-1 text-left transition-colors",
  {
    compoundVariants: [
      {
        active: true,
        className: "bg-orange-50/80 text-zinc-950 shadow-marble-stripe-left",
        tone: "neutral",
      },
      {
        active: true,
        className: "bg-white text-zinc-950 shadow-marble-stripe-left",
        tone: "orange",
      },
    ],
    defaultVariants: {
      active: false,
      align: "center",
      size: "md",
      tone: "neutral",
    },
    variants: {
      active: {
        false: "",
        true: "",
      },
      align: {
        center: "items-center",
        start: "items-start",
      },
      size: {
        compact: "gap-3 px-4 py-3",
        md: "gap-4 px-5 py-4",
        sm: "gap-3 px-4 py-2.5",
      },
      tone: {
        neutral: "hover:bg-zinc-50",
        orange: "hover:bg-white/70",
      },
    },
  },
);

const marbleListRowIconTileVariants = cva(
  "flex items-center justify-center rounded-xs border",
  {
    defaultVariants: {
      iconTone: "neutral",
      size: "md",
    },
    variants: {
      iconTone: {
        neutral: "border-taupe-200 bg-white/80 text-taupe-600",
        orange: "border-orange-200 bg-orange-50 text-orange-700",
      },
      size: {
        compact: "size-8",
        md: "size-9",
        sm: "size-8",
      },
    },
  },
);

type MarbleListRowIconTone = "neutral" | "orange";

export type MarbleListRowProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "title"
> &
  VariantProps<typeof marbleListRowButtonVariants> &
  VariantProps<typeof marbleListRowWrapperVariants> & {
    aside?: ReactNode;
    description?: ReactNode;
    descriptionClassName?: string;
    icon?: ReactNode;
    iconTone?: MarbleListRowIconTone;
    meta?: ReactNode;
    title: ReactNode;
    titleClassName?: string;
    wrapperClassName?: string;
  };

export function MarbleListRow({
  active,
  align,
  aside,
  className,
  description,
  descriptionClassName,
  disabled = false,
  icon,
  iconTone,
  meta,
  size,
  title,
  titleClassName,
  tone,
  type = "button",
  wrapperClassName,
  ...props
}: MarbleListRowProps) {
  const renderedIcon =
    icon && iconTone ? (
      <div
        className={marbleListRowIconTileVariants({
          iconTone,
          size,
        })}
      >
        {icon}
      </div>
    ) : icon ? (
      <div className="shrink-0">{icon}</div>
    ) : null;

  return (
    <div
      className={cx(
        marbleListRowWrapperVariants({
          tone,
        }),
        wrapperClassName,
      )}
    >
      <button
        className={cx(
          marbleListRowButtonVariants({
            active,
            align,
            size,
            tone,
          }),
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
        disabled={disabled}
        type={type}
        {...props}
      >
        {renderedIcon}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div
              className={cx(
                "truncate font-medium text-sm text-zinc-950",
                titleClassName,
              )}
            >
              {title}
            </div>
            {meta ? <div className="shrink-0">{meta}</div> : null}
          </div>

          {description ? (
            <div
              className={cx("mt-1 text-xs text-zinc-500", descriptionClassName)}
            >
              {description}
            </div>
          ) : null}
        </div>
      </button>

      {aside ? <div className="flex items-center px-3">{aside}</div> : null}
    </div>
  );
}
