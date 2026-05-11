import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

const marbleStatVariants = cva("", {
  compoundVariants: [
    {
      className: "rounded-xs border border-taupe-200 bg-taupe-50 px-3 py-2",
      framed: true,
      tone: "neutral",
    },
    {
      className: "rounded-xs border border-zinc-200 bg-zinc-50 px-3 py-2",
      framed: true,
      tone: "subtle",
    },
    {
      className: "space-y-1",
      framed: false,
      tone: "neutral",
    },
    {
      className: "space-y-1",
      framed: false,
      tone: "subtle",
    },
  ],
  defaultVariants: {
    framed: false,
    tone: "neutral",
  },
  variants: {
    framed: {
      false: "",
      true: "",
    },
    tone: {
      neutral: "",
      subtle: "",
    },
  },
});

const marbleStatLabelVariants = cva("font-medium text-eyebrow", {
  defaultVariants: {
    tone: "neutral",
  },
  variants: {
    tone: {
      neutral: "text-taupe-500",
      subtle: "text-zinc-500",
    },
  },
});

const marbleStatValueVariants = cva("font-medium", {
  defaultVariants: {
    framed: false,
    tone: "neutral",
  },
  variants: {
    framed: {
      false: "text-sm",
      true: "mt-1 text-sm",
    },
    tone: {
      neutral: "text-taupe-900",
      subtle: "text-zinc-900",
    },
  },
});

type MarbleStatTone = "neutral" | "subtle";

export type MarbleStatProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> &
  VariantProps<typeof marbleStatVariants> & {
    label: ReactNode;
    tone?: MarbleStatTone;
    value: ReactNode;
    valueClassName?: string;
  };

export function MarbleStat({
  className,
  framed,
  label,
  tone,
  value,
  valueClassName,
  ...props
}: MarbleStatProps) {
  return (
    <div
      className={cx(
        marbleStatVariants({
          framed,
          tone,
        }),
        className,
      )}
      {...props}
    >
      <div
        className={marbleStatLabelVariants({
          tone,
        })}
      >
        {label}
      </div>
      <div
        className={cx(
          marbleStatValueVariants({
            framed,
            tone,
          }),
          valueClassName,
        )}
      >
        {value}
      </div>
    </div>
  );
}
