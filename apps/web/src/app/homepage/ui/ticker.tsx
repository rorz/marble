"use client";

import { cx } from "@marble/ui";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

/**
 * Stat ticker — a label + monotonically increasing display value, with
 * a thin animated bar below. Used inside splashes to give the "live"
 * feel of compute being burned in real time.
 */

type MarketingTickerProps = {
  label: ReactNode;
  /** Starting integer value. */
  start?: number;
  /** Increment applied each tick. Set to `random` to vary per tick. */
  step?: number | "random";
  /** Tick interval in ms. */
  intervalMs?: number;
  /** Right-aligned trailing label (units). */
  suffix?: ReactNode;
  /** Pad the displayed integer to N digits. */
  pad?: number;
  /** Optional format helper applied before render. */
  format?: (value: number) => string;
  /** Color tone. */
  tone?: "orange" | "cream";
  /** Show a thin progress bar that loops every few seconds. */
  progress?: boolean;
  className?: string;
};

export const MarketingTicker = ({
  label,
  start = 0,
  step = 31,
  intervalMs = 90,
  suffix,
  pad = 8,
  format,
  tone = "orange",
  progress = true,
  className,
}: MarketingTickerProps) => {
  const [value, setValue] = useState(start);

  useEffect(() => {
    const id = window.setInterval(() => {
      setValue((current) => {
        const inc =
          step === "random" ? Math.floor(Math.random() * 50) + 8 : step;
        return current + inc;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [
    step,
    intervalMs,
  ]);

  const display = format ? format(value) : String(value).padStart(pad, "0");
  const tonedDigits = tone === "orange" ? "text-orange-400" : "text-taupe-100";

  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-xs border-2 border-current/15 bg-taupe-900/40 px-5 py-4",
        className,
      )}
    >
      <span className="flex items-center gap-2 font-mono text-eyebrow opacity-70">
        <span className="size-1.5 rounded-full bg-orange-500 animate-marketing-led" />
        {label}
      </span>
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cx(
            "font-mono font-medium text-3xl leading-none tabular-nums md:text-5xl animate-marketing-lcd",
            tonedDigits,
          )}
        >
          {display}
        </span>
        {suffix ? (
          <span className="font-mono text-eyebrow opacity-60">{suffix}</span>
        ) : null}
      </div>
      {progress ? (
        <span className="relative mt-1 h-px overflow-hidden bg-current/10">
          <span className="absolute inset-y-0 w-1/3 bg-orange-500 animate-marketing-marquee" />
        </span>
      ) : null}
    </div>
  );
};
