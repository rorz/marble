import { cx } from "@marble/ui";
import type { PropsWithChildren, ReactNode } from "react";

/**
 * Tactile "poster" card for marketing surfaces. Distinct from `MarbleCard`
 * — bigger borders, layered offset shadows, optional tilt.
 */

const TONES = {
  cream: "border-taupe-700 bg-taupe-100 text-taupe-800",
  dark: "border-taupe-100/10 bg-taupe-800 text-taupe-100",
  light: "border-taupe-700 bg-taupe-200 text-taupe-800",
  orange: "border-orange-700 bg-orange-500 text-orange-50",
} as const;

type Tone = keyof typeof TONES;

const ACCENTS = {
  bottom: "shadow-[6px_6px_0_0_var(--color-orange-500)]",
  none: "",
  poster: "border-l-8 border-b-5 border-orange-500",
} as const;

type Accent = keyof typeof ACCENTS;

type MarketingCardProps = PropsWithChildren<{
  tone?: Tone;
  accent?: Accent;
  className?: string;
  /** Subtle decorative rotation, in degrees. */
  tilt?: number;
}>;

export function MarketingCard({
  tone = "cream",
  accent = "none",
  className,
  tilt,
  children,
}: MarketingCardProps) {
  return (
    <div
      className={cx(
        "rounded-xs border-2 p-6 md:p-8",
        TONES[tone],
        ACCENTS[accent],
        className,
      )}
      style={
        tilt
          ? {
              transform: `rotate(${tilt}deg)`,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

type MarketingCardEyebrowProps = PropsWithChildren<{
  className?: string;
}>;

export function MarketingCardEyebrow({
  className,
  children,
}: MarketingCardEyebrowProps) {
  return (
    <span className={cx("font-mono text-eyebrow opacity-60", className)}>
      {children}
    </span>
  );
}

type MarketingCardTitleProps = PropsWithChildren<{
  className?: string;
  /** Display-font size scale. */
  size?: "sm" | "md" | "lg";
}>;

const TITLE_SIZES = {
  lg: "text-3xl md:text-4xl",
  md: "text-2xl md:text-3xl",
  sm: "text-xl md:text-2xl",
} as const;

export function MarketingCardTitle({
  size = "md",
  className,
  children,
}: MarketingCardTitleProps) {
  return (
    <h3
      className={cx(
        "font-display font-medium leading-tight tracking-tight",
        TITLE_SIZES[size],
        className,
      )}
    >
      {children}
    </h3>
  );
}

type MarketingCardBodyProps = PropsWithChildren<{
  className?: string;
}>;

export function MarketingCardBody({
  className,
  children,
}: MarketingCardBodyProps) {
  return (
    <p className={cx("text-base opacity-80 md:text-lg", className)}>
      {children}
    </p>
  );
}

type MarketingCardFooterProps = PropsWithChildren<{
  className?: string;
}>;

export function MarketingCardFooter({
  className,
  children,
}: MarketingCardFooterProps) {
  return (
    <div className={cx("flex flex-wrap items-center gap-3", className)}>
      {children}
    </div>
  );
}

type MarketingCardGridProps = PropsWithChildren<{
  columns?: 2 | 3 | 4;
  className?: string;
  gap?: "sm" | "md" | "lg";
}>;

const COLUMNS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
} as const;

const GAPS = {
  lg: "gap-8",
  md: "gap-6",
  sm: "gap-4",
} as const;

/**
 * Responsive grid for poster-style cards or tiles.
 */
export function MarketingCardGrid({
  columns = 3,
  gap = "md",
  className,
  children,
}: MarketingCardGridProps) {
  return (
    <div
      className={cx("grid grid-cols-1", COLUMNS[columns], GAPS[gap], className)}
    >
      {children}
    </div>
  );
}

type MarketingCardContentProps = PropsWithChildren<{
  className?: string;
}>;

/** Vertical-stack content wrapper for `MarketingCard` interior. */
export function MarketingCardContent({
  className,
  children,
}: MarketingCardContentProps) {
  return <div className={cx("flex flex-col gap-3", className)}>{children}</div>;
}

/** Big iconish glyph slot, e.g. for the head of a feature card. */
export function MarketingCardGlyph({
  className,
  children,
}: PropsWithChildren<{
  className?: string;
}>) {
  return (
    <div
      className={cx(
        "flex size-14 items-center justify-center rounded-xs border-2 border-current/30 text-current inset-shadow-2xs inset-shadow-white/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Inline pill/sticker affordance for callouts inside a card. */
export function MarketingCardPill({
  children,
  className,
  tone = "orange",
}: PropsWithChildren<{
  className?: string;
  tone?: "orange" | "neutral";
}>) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border-2 px-3 py-1 font-mono text-eyebrow-xs",
        tone === "orange"
          ? "border-orange-500 text-orange-500"
          : "border-current/30 text-current",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Renders the supplied children floated alongside the card, useful for
 * subtle annotation stickers or trailing decoration.
 */
export function MarketingCardAside({
  children,
  className,
  side = "right",
}: PropsWithChildren<{
  className?: string;
  side?: "left" | "right";
}>) {
  return (
    <div
      className={cx(
        "pointer-events-none absolute top-1/2 -translate-y-1/2",
        side === "left" ? "-left-12" : "-right-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

type MarketingPosterProps = PropsWithChildren<{
  /** Overlay heading laid on top of the children. */
  caption?: ReactNode;
  className?: string;
}>;

/**
 * Decorative framed container for visual "exhibits" (graphics, screenshots,
 * fake spreadsheet, schematic diagrams). Has the thick poster border.
 */
export function MarketingPoster({
  caption,
  className,
  children,
}: MarketingPosterProps) {
  return (
    <figure
      className={cx(
        "relative overflow-hidden rounded-xs border-2 border-taupe-700 bg-taupe-100 shadow-[6px_6px_0_0_var(--color-orange-500)]",
        className,
      )}
    >
      <div className="relative">{children}</div>
      {caption ? (
        <figcaption className="border-t-2 border-taupe-700 bg-taupe-100 px-4 py-3 font-mono text-eyebrow text-taupe-700">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
