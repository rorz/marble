import { cx } from "@marble/ui";
import type { ReactNode } from "react";

/**
 * Marketing display stat — display-font value with eyebrow label and
 * optional caption. Distinct from `MarbleStat` (compact app-side tile).
 */

const VALUE_SIZES = {
  lg: "text-6xl md:text-8xl",
  md: "text-5xl md:text-7xl",
  sm: "text-4xl md:text-5xl",
  xl: "text-7xl md:text-9xl",
} as const;

type ValueSize = keyof typeof VALUE_SIZES;

const VALUE_TONES = {
  cream: "text-taupe-100",
  current: "text-current",
  orange: "text-orange-500",
  taupe: "text-taupe-800",
} as const;

type ValueTone = keyof typeof VALUE_TONES;

type MarketingStatProps = {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  size?: ValueSize;
  tone?: ValueTone;
  align?: "start" | "center";
  className?: string;
};

export function MarketingStat({
  label,
  value,
  caption,
  size = "lg",
  tone = "current",
  align = "start",
  className,
}: MarketingStatProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <span className="font-mono text-eyebrow opacity-60">{label}</span>
      <span
        className={cx(
          "font-display font-medium leading-[0.9] tracking-tight",
          VALUE_SIZES[size],
          VALUE_TONES[tone],
        )}
      >
        {value}
      </span>
      {caption ? (
        <span className="max-w-md text-sm opacity-70 md:text-base">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

type MarketingStatGridProps = {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
};

const STAT_COLUMNS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
} as const;

export function MarketingStatGrid({
  children,
  columns = 3,
  className,
}: MarketingStatGridProps) {
  return (
    <div
      className={cx(
        "grid grid-cols-1 gap-10 md:gap-12",
        STAT_COLUMNS[columns],
        className,
      )}
    >
      {children}
    </div>
  );
}
