import { cx } from "@marble/ui";
import type { ReactNode } from "react";

/**
 * Small decorative "pinned" sticker — a circular badge for hero-style
 * embellishment. Use for things like "v1.0", "OSS", "new!".
 */

const TONES = {
  cream: "border-taupe-700 bg-taupe-100 text-taupe-800",
  dark: "border-taupe-100 bg-taupe-800 text-taupe-100",
  orange: "border-orange-700 bg-orange-500 text-orange-50",
} as const;

type Tone = keyof typeof TONES;

type MarketingPinProps = {
  children: ReactNode;
  tone?: Tone;
  rotate?: number;
  className?: string;
};

export function MarketingPin({
  children,
  tone = "orange",
  rotate,
  className,
}: MarketingPinProps) {
  return (
    <span
      className={cx(
        "inline-flex size-20 items-center justify-center rounded-full border-2 text-center font-display font-medium text-base leading-tight tracking-tight shadow-marble-highlight",
        TONES[tone],
        className,
      )}
      style={
        rotate
          ? {
              transform: `rotate(${rotate}deg)`,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

/**
 * Layered display wordmark — three offset copies of the text in
 * decreasing opacity. The hero already uses this for "Marble" — extracted
 * here for reuse on other sections (e.g. footer).
 */
type MarketingStackedWordmarkProps = {
  children: ReactNode;
  /** Font-size scale. */
  size?: "md" | "lg" | "xl";
  /** Accent color tokens to layer with. */
  tone?: "orange" | "cream";
  className?: string;
  /** Render as an h1 instead of inline span. Defaults to h1. */
  as?: "h1" | "h2" | "div";
};

const STACKED_SIZES = {
  lg: "text-[12rem] md:text-[16rem]",
  md: "text-[8rem] md:text-[12rem]",
  xl: "text-[16rem] md:text-[20rem]",
} as const;

const STACKED_TONES = {
  cream: {
    back: "text-taupe-100/20",
    front: "text-taupe-100",
    mid: "text-taupe-100/60",
  },
  orange: {
    back: "text-orange-500/20",
    front: "text-orange-600",
    mid: "text-orange-500/70",
  },
} as const;

export function MarketingStackedWordmark({
  children,
  size = "xl",
  tone = "orange",
  className,
  as = "h1",
}: MarketingStackedWordmarkProps) {
  const tones = STACKED_TONES[tone];
  const Outer = as;

  return (
    <div
      className={cx(
        "relative inline-block font-display font-medium leading-none tracking-tight",
        STACKED_SIZES[size],
        className,
      )}
    >
      <Outer className={cx("absolute -left-4 top-0", tones.back)}>
        {children}
      </Outer>
      <Outer className={cx("absolute -left-2 top-0", tones.mid)}>
        {children}
      </Outer>
      <Outer className={cx("relative", tones.front)}>{children}</Outer>
    </div>
  );
}

/** Small decorative dot row — used as a visual rhythm break. */
export function MarketingDotRow({
  count = 3,
  tone = "orange",
  className,
}: {
  count?: number;
  tone?: "orange" | "current";
  className?: string;
}) {
  return (
    <div
      className={cx("flex items-center gap-2", className)}
      role="presentation"
    >
      {Array.from({
        length: count,
      }).map((_, index) => (
        <span
          className={cx(
            "size-2 rounded-full",
            tone === "orange" ? "bg-orange-500" : "bg-current/40",
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: pure decoration
          key={index}
        />
      ))}
    </div>
  );
}
