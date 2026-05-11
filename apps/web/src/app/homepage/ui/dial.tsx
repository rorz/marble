"use client";

import { cx } from "@marble/ui";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

/**
 * Rotary knob — CSS-only "physical" dial with tick marks around the
 * perimeter, a pointer indicator, and an optional auto-sweep animation.
 */

const KNOB_SIZES = {
  lg: "size-44",
  md: "size-32",
  sm: "size-24",
  xl: "size-56",
} as const;

type KnobSize = keyof typeof KNOB_SIZES;

type MarketingDialProps = {
  /** Label rendered below the dial. */
  label?: ReactNode;
  /** Caption / current value below the label. */
  caption?: ReactNode;
  /** Dial angle in degrees, -135 (min) to 135 (max). */
  angle?: number;
  /** If true, animate the pointer sweeping back and forth. */
  sweep?: boolean;
  size?: KnobSize;
  /** Color tone. */
  tone?: "dark" | "cream" | "orange";
  className?: string;
};

export function MarketingDial({
  label,
  caption,
  angle = -45,
  sweep = false,
  size = "md",
  tone = "dark",
  className,
}: MarketingDialProps) {
  const [autoAngle, setAutoAngle] = useState(angle);

  useEffect(() => {
    if (!sweep) return;
    let frame = 0;
    let direction = 1;
    let current = angle;
    const id = window.setInterval(() => {
      current += direction * 4;
      if (current >= 130) direction = -1;
      if (current <= -130) direction = 1;
      frame += 1;
      setAutoAngle(current);
    }, 90);
    return () => {
      window.clearInterval(id);
      void frame;
    };
  }, [
    sweep,
    angle,
  ]);

  const indicatorAngle = sweep ? autoAngle : angle;

  const surface =
    tone === "orange"
      ? "border-orange-800 bg-orange-500 text-orange-50"
      : tone === "cream"
        ? "border-taupe-700 bg-taupe-100 text-taupe-900"
        : "border-taupe-900 bg-taupe-800 text-taupe-50";

  return (
    <div className={cx("flex flex-col items-center gap-3", className)}>
      <div
        className={cx(
          "relative isolate flex items-center justify-center rounded-full border-2 inset-shadow-2xs inset-shadow-white/70",
          KNOB_SIZES[size],
          surface,
        )}
      >
        <KnobTicks />
        <div
          className="absolute inset-3 rounded-full border border-current/30 bg-current/5"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.18), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-5 rounded-full border border-current/20 transition-transform duration-200"
          style={{
            transform: `rotate(${indicatorAngle}deg)`,
          }}
        >
          <span className="-translate-x-1/2 absolute top-2 left-1/2 block h-3 w-1 rounded-full bg-orange-400" />
        </div>
        <span className="relative font-mono text-eyebrow-xs opacity-50">▾</span>
      </div>
      {label ? (
        <span className="font-mono text-eyebrow opacity-70">{label}</span>
      ) : null}
      {caption ? (
        <span className="font-display font-medium text-xl leading-none tracking-tight md:text-2xl">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

function KnobTicks() {
  // 24 tick marks distributed around the perimeter — a classic TE knob.
  const ticks = Array.from({
    length: 24,
  });
  return (
    <div
      aria-hidden
      className="absolute inset-0"
    >
      {ticks.map((_, index) => {
        const angle = (index / ticks.length) * 360;
        const isMajor = index % 6 === 0;
        return (
          <span
            className={cx(
              "-translate-x-1/2 absolute top-0 left-1/2 block",
              isMajor ? "h-2 w-px bg-current/60" : "h-1.5 w-px bg-current/30",
            )}
            // biome-ignore lint/suspicious/noArrayIndexKey: pure decoration
            key={index}
            style={{
              transform: `rotate(${angle}deg) translateY(2px)`,
              transformOrigin: "center 50%",
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Vertical fader / mixer slider. CSS-only with optional animated handle.
 */

type MarketingFaderProps = {
  label?: ReactNode;
  /** Caption rendered below the label. */
  caption?: ReactNode;
  /** 0..1 — where the handle sits along the track. */
  value?: number;
  /** Animate the handle moving up and down. */
  animate?: boolean;
  /** Height of the fader track. */
  height?: "md" | "lg";
  tone?: "orange" | "cream";
  className?: string;
};

export function MarketingFader({
  label,
  caption,
  value = 0.7,
  animate = false,
  height = "md",
  tone = "orange",
  className,
}: MarketingFaderProps) {
  const [position, setPosition] = useState(value);

  useEffect(() => {
    if (!animate) return;
    let dir = 1;
    let current = value;
    const id = window.setInterval(() => {
      current += dir * 0.02;
      if (current > 0.95) dir = -1;
      if (current < 0.2) dir = 1;
      setPosition(current);
    }, 120);
    return () => window.clearInterval(id);
  }, [
    animate,
    value,
  ]);

  const handlePercent = Math.min(0.95, Math.max(0.05, position)) * 100;
  const handleSurface =
    tone === "orange"
      ? "border-orange-800 bg-orange-500"
      : "border-taupe-700 bg-taupe-100";

  return (
    <div className={cx("flex flex-col items-center gap-3", className)}>
      <div
        className={cx(
          "relative flex w-10 justify-center rounded-xs border-2 border-current/20 bg-current/5",
          height === "lg" ? "h-56" : "h-40",
        )}
      >
        {/* Track */}
        <span className="absolute inset-y-2 w-1 rounded-full bg-current/20" />
        {/* Tick marks */}
        <div
          aria-hidden
          className="absolute inset-y-2 flex w-full flex-col justify-between py-1"
        >
          {Array.from({
            length: 7,
          }).map((_, index) => (
            <span
              className="mx-auto h-px w-3 bg-current/30"
              // biome-ignore lint/suspicious/noArrayIndexKey: pure decoration
              key={index}
            />
          ))}
        </div>
        {/* Handle */}
        <span
          className={cx(
            "absolute left-1/2 flex h-5 w-7 -translate-x-1/2 items-center justify-center rounded-xs border-2 inset-shadow-2xs inset-shadow-white/70 transition-all duration-200",
            handleSurface,
          )}
          style={{
            bottom: `calc(${handlePercent}% - 10px)`,
          }}
        >
          <span className="block h-0.5 w-3 bg-taupe-900/60" />
        </span>
      </div>
      {label ? (
        <span className="font-mono text-eyebrow opacity-70">{label}</span>
      ) : null}
      {caption ? (
        <span className="font-mono text-eyebrow-xs opacity-60">{caption}</span>
      ) : null}
    </div>
  );
}
