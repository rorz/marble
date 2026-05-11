"use client";

import { cx } from "@marble/ui";
import type { PropsWithChildren, ReactNode } from "react";
import { useEffect, useState } from "react";

/**
 * Faux-LCD display panel — dark inset screen with mono "digit" type, a
 * subtle scanline overlay, and a glow on the active value. Use inside a
 * `MarketingPanel` to compose an instrument.
 */

const SCREEN_SIZES = {
  lg: "px-6 py-5 text-3xl md:text-5xl",
  md: "px-5 py-4 text-2xl md:text-4xl",
  sm: "px-4 py-3 text-lg md:text-2xl",
  xl: "px-7 py-6 text-4xl md:text-7xl",
} as const;

type ScreenSize = keyof typeof SCREEN_SIZES;

type MarketingLCDProps = PropsWithChildren<{
  /** Eyebrow label rendered above the display ("MS BURNED", "RUN ID"). */
  label?: ReactNode;
  /** Optional smaller text below the value. */
  caption?: ReactNode;
  size?: ScreenSize;
  /** Pulse-glow the value. */
  active?: boolean;
  /** Tint the digits. */
  digitTone?: "orange" | "cream";
  className?: string;
}>;

export function MarketingLCD({
  label,
  caption,
  size = "md",
  active = true,
  digitTone = "orange",
  className,
  children,
}: MarketingLCDProps) {
  return (
    <div
      className={cx(
        "relative isolate overflow-hidden rounded-xs border-2 border-taupe-900 marketing-lcd-screen",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 marketing-scanlines"
      />
      <div className={cx("relative flex flex-col gap-1", SCREEN_SIZES[size])}>
        {label ? (
          <span className="font-mono text-eyebrow-xs text-orange-300/70">
            {label}
          </span>
        ) : null}
        <div
          className={cx(
            "font-mono font-medium leading-none tabular-nums",
            digitTone === "orange" ? "text-orange-400" : "text-taupe-100",
            active && "animate-marketing-lcd",
          )}
        >
          {children}
        </div>
        {caption ? (
          <span className="font-mono text-eyebrow-xs text-orange-200/60">
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Live-ticking digit run — re-renders the supplied digit sequence at the
 * provided interval. Used to convey "live compute" or "live workspace
 * activity" in headline displays.
 */
type MarketingLCDCounterProps = {
  /** Start counting from this value. */
  start?: number;
  /** Step added each tick. */
  step?: number;
  /** Tick interval in ms. */
  intervalMs?: number;
  /** Total digit width (pads with zeros on the left). */
  pad?: number;
  /** Optional formatter wrapping the value. */
  format?: (value: number) => string;
  /** Optional trailing suffix (e.g. "ms"). */
  suffix?: ReactNode;
  className?: string;
};

export function MarketingLCDCounter({
  start = 0,
  step = 17,
  intervalMs = 80,
  pad = 8,
  format,
  suffix,
  className,
}: MarketingLCDCounterProps) {
  const [value, setValue] = useState(start);

  useEffect(() => {
    const id = window.setInterval(() => {
      setValue((current) => current + step);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [
    step,
    intervalMs,
  ]);

  const display = format ? format(value) : String(value).padStart(pad, "0");

  return (
    <span className={cx("inline-flex items-baseline gap-2", className)}>
      <span>{display}</span>
      {suffix ? (
        <span className="font-mono text-eyebrow text-orange-300/70">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Inline "waveform" — pure CSS bar chart used inside an LCD display as
 * decoration suggesting a signal / oscillation. Bars animate up/down.
 */
export function MarketingLCDWaveform({
  bars = 24,
  className,
}: {
  bars?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cx("flex h-8 items-end gap-0.5", className)}
    >
      {Array.from({
        length: bars,
      }).map((_, index) => (
        <span
          className="block w-1 rounded-xs bg-orange-400/80 animate-marketing-tick"
          // biome-ignore lint/suspicious/noArrayIndexKey: pure decoration
          key={index}
          style={{
            animationDelay: `${(index % 7) * 90}ms`,
            height: `${30 + ((index * 37) % 70)}%`,
          }}
        />
      ))}
    </div>
  );
}
