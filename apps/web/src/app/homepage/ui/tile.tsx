import { cx } from "@marble/ui";
import type { ReactNode } from "react";

/**
 * Marketing feature tile — for grids that explain product capabilities.
 * Stacks: optional glyph slot → numbered index → headline → body → footer.
 *
 * Distinct from `MarketingCard` in that tiles are more compact, lean
 * dense-grid-friendly, and accept a hero glyph in a fixed slot.
 */

const TONES = {
  cream: "border-taupe-700 bg-taupe-100 text-taupe-800",
  dark: "border-taupe-100/15 bg-taupe-800 text-taupe-100",
  light: "border-taupe-700 bg-taupe-200 text-taupe-800",
  midnight: "border-taupe-100/10 bg-taupe-900 text-taupe-100",
  orange: "border-orange-700 bg-orange-500 text-orange-50",
} as const;

type Tone = keyof typeof TONES;

type MarketingTileProps = {
  /** Eyebrow / kicker label. */
  eyebrow?: ReactNode;
  /** Optional ordinal — rendered display-sized inside the glyph slot. */
  index?: ReactNode;
  /** Optional glyph (icon or arbitrary node) for the head of the tile. */
  glyph?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** Footer slot — for "Learn more" links or chips. */
  footer?: ReactNode;
  tone?: Tone;
  /** Make the title display-font and big. */
  emphasize?: boolean;
  className?: string;
};

export function MarketingTile({
  eyebrow,
  index,
  glyph,
  title,
  body,
  footer,
  tone = "cream",
  emphasize = false,
  className,
}: MarketingTileProps) {
  return (
    <article
      className={cx(
        "flex h-full flex-col gap-4 rounded-xs border-2 p-6 md:p-7",
        TONES[tone],
        className,
      )}
    >
      {index !== undefined || glyph ? (
        <header className="flex items-center gap-3">
          {index !== undefined ? (
            <span className="font-display font-medium text-4xl leading-none text-orange-500 md:text-5xl">
              {index}
            </span>
          ) : null}
          {glyph ? (
            <span className="flex size-12 items-center justify-center rounded-xs border-2 border-current/30 text-current shadow-marble-highlight">
              {glyph}
            </span>
          ) : null}
        </header>
      ) : null}
      <div className="flex flex-col gap-2">
        {eyebrow ? (
          <span className="font-mono text-eyebrow opacity-60">{eyebrow}</span>
        ) : null}
        <h3
          className={cx(
            "tracking-tight",
            emphasize
              ? "font-display font-medium text-2xl leading-tight md:text-3xl"
              : "font-display font-medium text-xl leading-tight md:text-2xl",
          )}
        >
          {title}
        </h3>
        {body ? (
          <p className="text-base opacity-80 md:text-lg">{body}</p>
        ) : null}
      </div>
      {footer ? <div className="mt-auto pt-2">{footer}</div> : null}
    </article>
  );
}
