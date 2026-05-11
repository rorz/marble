import { cx } from "@marble/ui";
import type { ReactNode } from "react";

/**
 * Marketing logo strip — used for "works with" / "powered by" attribution.
 * We don't have third-party logo SVGs yet, so each mark renders as a typed
 * wordmark inside a bordered tile. Easy to swap individual marks for SVG
 * children when we have them.
 */

const TONES = {
  cream: "border-taupe-700 bg-taupe-100 text-taupe-800",
  dark: "border-taupe-100/20 bg-taupe-900/30 text-taupe-100",
  light: "border-taupe-700 bg-taupe-200 text-taupe-800",
  midnight: "border-taupe-100/10 bg-taupe-800 text-taupe-100",
} as const;

type Tone = keyof typeof TONES;

type MarketingLogoMarkProps = {
  /** Wordmark name. */
  name: string;
  /** Optional smaller caption rendered above the wordmark. */
  caption?: string;
  /** Optional glyph rendered to the left of the wordmark. */
  glyph?: ReactNode;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const NAME_SIZES = {
  lg: "text-2xl md:text-3xl",
  md: "text-xl md:text-2xl",
  sm: "text-base md:text-lg",
} as const;

export function MarketingLogoMark({
  name,
  caption,
  glyph,
  tone = "cream",
  size = "md",
  className,
}: MarketingLogoMarkProps) {
  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-xs border-2 px-5 py-4",
        TONES[tone],
        className,
      )}
    >
      {glyph ? (
        <span className="flex size-9 items-center justify-center rounded-full border-2 border-current/40 text-current inset-shadow-2xs inset-shadow-white/70">
          {glyph}
        </span>
      ) : null}
      <div className="flex flex-col gap-0.5">
        {caption ? (
          <span className="font-mono text-eyebrow-xs opacity-60">
            {caption}
          </span>
        ) : null}
        <span
          className={cx(
            "font-display font-medium leading-none tracking-tight",
            NAME_SIZES[size],
          )}
        >
          {name}
        </span>
      </div>
    </div>
  );
}

type MarketingLogoStripProps = {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
  align?: "start" | "center";
};

export function MarketingLogoStrip({
  label,
  children,
  className,
  align = "start",
}: MarketingLogoStripProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {label ? (
        <span className="font-mono text-eyebrow opacity-60">{label}</span>
      ) : null}
      <div className="flex flex-wrap gap-3 md:gap-4">{children}</div>
    </div>
  );
}
