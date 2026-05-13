import { cx } from "@marble/ui";
import Image from "next/image";
import type { PropsWithChildren, ReactNode } from "react";

/**
 * Full-bleed splash interlude — a "whole-page break" with a giant image
 * (or canvas), gradient veil, and superimposed display-sized type.
 *
 * Inspired by the Teenage Engineering product page rhythm — big visual
 * cards that interrupt the column-of-content flow with a single, loud
 * statement.
 */

const VEILS = {
  /** No overlay. */
  none: "",
  /** Heavy orange wash. */
  orange:
    "bg-[radial-gradient(120%_80%_at_50%_0%,rgba(249,115,22,0.5)_0%,transparent_60%)]",
  /** Dark gradient from bottom (text bottom-anchored). */
  shadow: "bg-gradient-to-t from-taupe-900/85 via-taupe-900/40 to-transparent",
  /** Vignette pull-in (text center-anchored). */
  vignette:
    "bg-[radial-gradient(80%_60%_at_50%_50%,transparent_0%,rgba(20,18,16,0.55)_70%,rgba(20,18,16,0.85)_100%)]",
} as const;

type Veil = keyof typeof VEILS;

const HEIGHTS = {
  full: "min-h-screen",
  md: "min-h-[60vh]",
  sm: "min-h-[42vh]",
  tall: "min-h-[80vh]",
} as const;

type Height = keyof typeof HEIGHTS;

type MarketingSplashProps = PropsWithChildren<{
  /** Path to a static image rendered full-bleed behind everything. */
  imageSrc?: string;
  imageAlt?: string;
  /** Background fallback color tone when no image is provided. */
  tone?: "darkest" | "dark" | "cream" | "orange";
  /** Vertical height. */
  height?: Height;
  /** Veil overlay rendered above the image, below the content. */
  veil?: Veil;
  /** Position the image inside the frame. */
  imagePosition?: "center" | "left" | "right" | "bottom";
  /** Make image float gently on a loop. */
  imageFloat?: boolean;
  /** Custom image scale (e.g. 1.2 zooms in 20%). */
  imageScale?: number;
  className?: string;
  id?: string;
}>;

const TONE_BG = {
  cream: "bg-taupe-100 text-taupe-900",
  dark: "bg-taupe-700 text-taupe-50",
  darkest: "bg-taupe-900 text-taupe-50",
  orange: "bg-orange-600 text-orange-50",
} as const;

const IMAGE_POSITIONS = {
  bottom: "object-bottom",
  center: "object-center",
  left: "object-left",
  right: "object-right",
} as const;

export const MarketingSplash = ({
  imageSrc,
  imageAlt = "",
  tone = "darkest",
  height = "tall",
  veil = "vignette",
  imagePosition = "center",
  imageFloat = false,
  imageScale,
  className,
  id,
  children,
}: MarketingSplashProps) => {
  return (
    <section
      className={cx(
        "relative isolate flex w-full flex-col overflow-hidden",
        TONE_BG[tone],
        HEIGHTS[height],
        className,
      )}
      id={id}
    >
      {imageSrc ? (
        <div
          className={cx(
            "absolute inset-0 -z-10",
            imageFloat && "animate-marketing-float-slow",
          )}
          style={
            imageScale
              ? {
                  transform: `scale(${imageScale})`,
                }
              : undefined
          }
        >
          <Image
            alt={imageAlt}
            className={cx(
              "size-full object-cover",
              IMAGE_POSITIONS[imagePosition],
            )}
            fill
            priority={false}
            sizes="100vw"
            src={imageSrc}
          />
        </div>
      ) : null}
      <div
        aria-hidden
        className={cx(
          "pointer-events-none absolute inset-0 -z-10",
          VEILS[veil],
        )}
      />
      {children}
    </section>
  );
};

/**
 * Layered content slot for `MarketingSplash` — centers a content cluster
 * over the visual.
 */
export const MarketingSplashContent = ({
  className,
  align = "center",
  children,
}: PropsWithChildren<{
  className?: string;
  align?: "start" | "center" | "end";
}>) => {
  return (
    <div
      className={cx(
        "relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 pt-24 pb-20 md:px-10 md:pt-32 md:pb-24",
        align === "center" && "items-center text-center justify-center",
        align === "end" && "items-start justify-end",
        align === "start" && "items-start justify-start",
        className,
      )}
    >
      {children}
    </div>
  );
};

/**
 * Massive splash title — uses display font + ultra-tight tracking. Drops
 * into a `MarketingSplash` for the headline statement.
 */
export const MarketingSplashTitle = ({
  children,
  className,
  size = "lg",
}: PropsWithChildren<{
  className?: string;
  size?: "md" | "lg" | "xl";
}>) => {
  const sizes = {
    lg: "text-7xl md:text-[10rem]",
    md: "text-6xl md:text-8xl",
    xl: "text-8xl md:text-[14rem]",
  } as const;
  return (
    <h2
      className={cx(
        "font-display font-medium leading-[0.85] tracking-tighter",
        sizes[size],
        className,
      )}
    >
      {children}
    </h2>
  );
};

/**
 * Small monospaced "specification line" rendered alongside the title.
 * Pure TE-style label energy — "EP-001 / RT-MARBLE / OSS-MIT".
 */
export const MarketingSplashSpec = ({
  children,
  className,
}: PropsWithChildren<{
  className?: string;
}>) => {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 font-mono text-eyebrow opacity-70",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current animate-marketing-tick" />
      {children}
    </span>
  );
};

/**
 * Horizontal scrolling marquee strip. Use as a full-bleed visual page-break
 * — typically just a single chunky line of repeating text in alternating
 * tones.
 */
const MARQUEE_TONES = {
  cream: "border-taupe-700 bg-taupe-100 text-taupe-900",
  dark: "border-taupe-700 bg-taupe-900 text-taupe-50",
  orange: "border-orange-700 bg-orange-500 text-orange-50",
} as const;

type MarqueeTone = keyof typeof MARQUEE_TONES;

type MarketingMarqueeProps = {
  /** Repeating phrase. */
  phrase: ReactNode;
  /** Optional separator between repetitions (e.g. "·", "★"). */
  separator?: ReactNode;
  tone?: MarqueeTone;
  /** Direction. */
  direction?: "left" | "right";
  /** Animation speed: slow / normal / fast. */
  speed?: "slow" | "normal" | "fast";
  /** Tilt the strip slightly for energy. */
  tilt?: number;
  className?: string;
};

export const MarketingMarquee = ({
  phrase,
  separator = "·",
  tone = "orange",
  direction = "left",
  speed = "normal",
  tilt,
  className,
}: MarketingMarqueeProps) => {
  // Duplicate so the marquee animation can loop seamlessly.
  const items = Array.from({
    length: 12,
  });
  return (
    <div
      className={cx(
        "relative isolate w-full overflow-hidden border-y-4",
        MARQUEE_TONES[tone],
        className,
      )}
      style={
        tilt
          ? {
              transform: `rotate(${tilt}deg)`,
              transformOrigin: "center",
            }
          : undefined
      }
    >
      <div
        className={cx(
          "flex w-max items-center gap-10 py-5 font-display font-medium text-5xl uppercase leading-none tracking-tight md:py-7 md:text-7xl",
          direction === "left"
            ? speed === "fast"
              ? "animate-marketing-marquee-fast"
              : speed === "slow"
                ? "animate-marketing-marquee-reverse"
                : "animate-marketing-marquee"
            : "animate-marketing-marquee-reverse",
        )}
      >
        {items.map((_, index) => (
          <span
            className="flex shrink-0 items-center gap-10"
            // biome-ignore lint/suspicious/noArrayIndexKey: pure decoration
            key={index}
          >
            <span>{phrase}</span>
            <span
              aria-hidden
              className="opacity-50"
            >
              {separator}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * Stacked marquee strips — two rows of marquee scrolling in opposite
 * directions for a "billboard" effect.
 */
type MarketingMarqueeStackProps = {
  rows: Array<{
    phrase: ReactNode;
    tone?: MarqueeTone;
    direction?: "left" | "right";
    speed?: "slow" | "normal" | "fast";
    separator?: ReactNode;
  }>;
  className?: string;
};

export const MarketingMarqueeStack = ({
  rows,
  className,
}: MarketingMarqueeStackProps) => {
  return (
    <div className={cx("flex flex-col", className)}>
      {rows.map((row, index) => (
        <MarketingMarquee
          direction={row.direction}
          // biome-ignore lint/suspicious/noArrayIndexKey: stable row index
          key={index}
          phrase={row.phrase}
          separator={row.separator}
          speed={row.speed}
          tone={row.tone}
        />
      ))}
    </div>
  );
};
