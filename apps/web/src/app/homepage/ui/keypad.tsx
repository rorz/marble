import { cx } from "@marble/ui";
import type { PropsWithChildren, ReactNode } from "react";

/**
 * K.O. II-style chiclet keypad. Each key is a slightly raised square
 * tile with a mono index label, a big display character, and an optional
 * micro-caption. Active state gets the orange highlight + glow.
 */

const KEY_TONES = {
  cream: cx(
    "border-taupe-700 bg-taupe-100 text-taupe-900",
    "inset-shadow-2xs inset-shadow-white/70",
  ),
  dark: cx(
    "border-taupe-900 bg-taupe-800 text-taupe-50",
    "inset-shadow-2xs inset-shadow-white/90",
  ),
  midnight: cx(
    "border-taupe-900/80 bg-taupe-900 text-taupe-50",
    "inset-shadow-2xs inset-shadow-white/45",
  ),
  orange: cx(
    "border-orange-800 bg-orange-500 text-orange-50",
    "inset-shadow-2xs inset-shadow-white/90",
  ),
} as const;

type KeyTone = keyof typeof KEY_TONES;

const KEY_SIZES = {
  lg: "p-5",
  md: "p-4",
  sm: "p-3",
} as const;

type KeySize = keyof typeof KEY_SIZES;

type MarketingKeyProps = {
  /** Big display character (a single letter / glyph). */
  glyph: ReactNode;
  /** Mono index label rendered top-left. */
  index?: ReactNode;
  /** Mono caption rendered bottom inside. */
  caption?: ReactNode;
  tone?: KeyTone;
  size?: KeySize;
  /** Pressed / selected state. */
  active?: boolean;
  /** LED-style indicator in top-right. */
  led?: boolean;
  /** Press-down hover effect. */
  pressable?: boolean;
  /** Make the key shimmer with a pulsing ring. */
  attention?: boolean;
  className?: string;
};

export function MarketingKey({
  glyph,
  index,
  caption,
  tone = "dark",
  size = "md",
  active = false,
  led = false,
  pressable = true,
  attention = false,
  className,
}: MarketingKeyProps) {
  return (
    <div
      className={cx(
        "relative isolate flex aspect-square flex-col rounded-xs border-2 transition-transform duration-150",
        KEY_SIZES[size],
        active ? KEY_TONES.orange : KEY_TONES[tone],
        pressable &&
          "hover:-translate-y-0.5 hover:inset-shadow-2xs hover:inset-shadow-white/90 active:translate-y-0",
        attention && "animate-marketing-pulse-ring",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-1">
        {index !== undefined ? (
          <span className="font-mono text-eyebrow-xs opacity-60">{index}</span>
        ) : (
          <span />
        )}
        {led ? (
          <span
            className={cx(
              "size-1.5 rounded-full",
              active ? "bg-taupe-100" : "bg-orange-500 animate-marketing-led",
            )}
          />
        ) : null}
      </div>
      <div className="flex flex-1 items-center justify-center">
        <span className="font-display font-medium text-4xl leading-none tracking-tight md:text-5xl">
          {glyph}
        </span>
      </div>
      {caption ? (
        <span className="text-center font-mono text-eyebrow-xs opacity-70">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

const KEYPAD_COLS = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  6: "grid-cols-3 md:grid-cols-6",
  8: "grid-cols-4 md:grid-cols-8",
} as const;

const KEYPAD_GAPS = {
  lg: "gap-3",
  md: "gap-2",
  sm: "gap-1.5",
} as const;

type MarketingKeypadProps = PropsWithChildren<{
  columns?: keyof typeof KEYPAD_COLS;
  gap?: keyof typeof KEYPAD_GAPS;
  className?: string;
}>;

export function MarketingKeypad({
  columns = 6,
  gap = "md",
  className,
  children,
}: MarketingKeypadProps) {
  return (
    <div
      className={cx("grid", KEYPAD_COLS[columns], KEYPAD_GAPS[gap], className)}
    >
      {children}
    </div>
  );
}

/**
 * A wider rectangular utility key — e.g. for "FN", "REC", "PLAY" type
 * controls. Compose with the same key chrome.
 */
type MarketingKeyBarProps = {
  label: ReactNode;
  caption?: ReactNode;
  tone?: KeyTone;
  active?: boolean;
  led?: boolean;
  className?: string;
};

export function MarketingKeyBar({
  label,
  caption,
  tone = "midnight",
  active = false,
  led = false,
  className,
}: MarketingKeyBarProps) {
  return (
    <div
      className={cx(
        "relative flex items-center justify-between gap-3 rounded-xs border-2 px-4 py-3 transition-transform hover:-translate-y-0.5",
        active ? KEY_TONES.orange : KEY_TONES[tone],
        className,
      )}
    >
      <div className="flex flex-col">
        <span className="font-display font-medium text-base leading-tight md:text-lg">
          {label}
        </span>
        {caption ? (
          <span className="font-mono text-eyebrow-xs opacity-60">
            {caption}
          </span>
        ) : null}
      </div>
      {led ? (
        <span
          className={cx(
            "size-1.5 rounded-full",
            active ? "bg-taupe-100" : "bg-orange-500 animate-marketing-led",
          )}
        />
      ) : null}
    </div>
  );
}
