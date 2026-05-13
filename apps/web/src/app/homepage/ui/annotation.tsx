import { cx } from "@marble/ui";
import type { ReactNode } from "react";

/**
 * Hand-drawn-feel sticker / speech-bubble overlay. Used for emphasis text
 * such as "Finally...!" or "and for!" in the hero. Carries an optional
 * decorative "tail" pointing toward the underlying element.
 */

const TONES = {
  cream: "bg-taupe-100 text-taupe-800",
  dark: "bg-taupe-800 text-taupe-100",
  mid: "bg-taupe-500 text-taupe-100",
  orange: "bg-orange-500 text-orange-50",
} as const;

type Tone = keyof typeof TONES;

const SIZES = {
  lg: "text-6xl md:text-7xl px-12 py-7",
  md: "text-4xl md:text-5xl px-8 py-5",
  sm: "text-2xl md:text-3xl px-6 py-3",
} as const;

type Size = keyof typeof SIZES;

type Tail =
  | {
      side: "left" | "right";
      rotate?: number;
    }
  | {
      side: "bottom";
      rotate?: number;
    }
  | null;

type MarketingAnnotationProps = {
  children: ReactNode;
  tone?: Tone;
  size?: Size;
  /** Decorative degree rotation, e.g. -3 for casually leaning. */
  rotate?: number;
  /** Render an italic feel for the inner text. */
  italic?: boolean;
  /** Whether to draw the speech-bubble tail. */
  tail?: Tail;
  className?: string;
};

export const MarketingAnnotation = ({
  children,
  tone = "mid",
  size = "md",
  rotate,
  italic = true,
  tail = null,
  className,
}: MarketingAnnotationProps) => {
  const toneClass = TONES[tone];
  return (
    <span
      className={cx(
        "relative inline-block rounded-full font-display font-regular leading-none",
        SIZES[size],
        toneClass,
        italic && "italic",
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
      {tail ? (
        <Tail
          tail={tail}
          toneClass={toneClass}
        />
      ) : null}
      <span className="relative">{children}</span>
    </span>
  );
};

const Tail = ({ tail, toneClass }: { tail: Tail; toneClass: string }) => {
  if (!tail) return null;
  const baseSize = "size-14";
  if (tail.side === "bottom") {
    return (
      <span
        className={cx(
          "absolute -bottom-2 left-8 size-12 rounded-sm",
          toneClass,
        )}
        style={{
          transform: `rotate(${tail.rotate ?? -12}deg)`,
        }}
      />
    );
  }
  return (
    <span
      className={cx(
        "absolute top-1/2 -translate-y-1/2 rounded-sm",
        baseSize,
        toneClass,
        tail.side === "left" ? "-left-6" : "-right-6",
      )}
      style={{
        transform: `rotate(${tail.rotate ?? -12}deg)`,
      }}
    />
  );
};

/**
 * Inline word-level emphasis — leans the word and on-hover snaps it back.
 * Mirrors the existing hero "and for!" treatment so it can be reused.
 */
export const MarketingInlineWink = ({
  children,
  direction = "left",
  tone = "current",
  className,
}: {
  children: ReactNode;
  direction?: "left" | "right";
  tone?: "current" | "taupe" | "orange";
  className?: string;
}) => {
  return (
    <span
      className={cx(
        "inline-block -translate-y-1 transition-transform hover:translate-y-0 hover:rotate-0",
        direction === "left" ? "-rotate-3" : "rotate-3",
        tone === "taupe" && "text-taupe-500",
        tone === "orange" && "text-orange-500",
        className,
      )}
    >
      {children}
    </span>
  );
};
