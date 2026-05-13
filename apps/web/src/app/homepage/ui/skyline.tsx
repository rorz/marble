import { cx } from "@marble/ui";
import type { ReactNode } from "react";
import {
  MarketingSkyscraper,
  type MarketingSkyscraperProps,
} from "./skyscraper";

/**
 * Marketing "skyline" — a row of Marble columns rendered as
 * skyscrapers. Each tower is a column, each window is a cell, lit
 * windows convey live activity. Composes {@link MarketingSkyscraper}.
 */

export type { MarketingSkyscraperProps };
export { MarketingSkyscraper };

/**
 * The full-bleed skyline container. Renders a horizontal row of towers
 * with a perspective tilt (Godzilla look-up). Anchor inside a splash.
 */

type MarketingSkylineProps = {
  buildings: MarketingSkyscraperProps[];
  /** Perspective tilt in degrees. Defaults to subtle 8°. */
  tilt?: number;
  /** Render an orange horizon stripe at the foot. */
  horizon?: boolean;
  /** Wrap node — typically content overlaying the skyline. */
  overlay?: ReactNode;
  className?: string;
};

export const MarketingSkyline = ({
  buildings,
  tilt = 8,
  horizon = true,
  overlay,
  className,
}: MarketingSkylineProps) => {
  return (
    <div className={cx("relative isolate w-full", className)}>
      {/* The buildings — tilted back via perspective. */}
      <div
        className="marketing-perspective relative w-full"
        style={{
          perspectiveOrigin: "50% 100%",
        }}
      >
        <div
          className="marketing-preserve-3d flex w-full items-end justify-center gap-2 px-4 pb-0 md:gap-3 md:px-8"
          style={{
            transform: `rotateX(${tilt}deg)`,
            transformOrigin: "center bottom",
          }}
        >
          {buildings.map((building) => (
            <MarketingSkyscraper
              key={building.name}
              {...building}
            />
          ))}
        </div>
      </div>

      {/* Glowing horizon line */}
      {horizon ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 left-0 h-[3px] bg-orange-500 shadow-[0_0_22px_rgba(249,115,22,0.85)]"
        />
      ) : null}

      {/* Optional overlay content */}
      {overlay ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {overlay}
        </div>
      ) : null}
    </div>
  );
};

/**
 * A reasonable default fleet of towers used in showcases / defaults.
 * Real consumers should supply their own list (typically seeded by
 * platform metrics).
 */
export const MARKETING_SKYLINE_DEMO: MarketingSkyscraperProps[] = [
  {
    cellCount: 1248,
    code: "C1",
    name: "lead_score",
    rows: 20,
    status: "running",
  },
  {
    cellCount: 612,
    code: "C2",
    name: "enrich",
    rows: 14,
    status: "running",
    width: "sm",
  },
  {
    cellCount: 2104,
    code: "C3",
    name: "summarize",
    rows: 26,
    status: "running",
    width: "lg",
  },
  {
    cellCount: 489,
    code: "C4",
    name: "qualify",
    rows: 12,
    status: "queued",
  },
  {
    cellCount: 1882,
    code: "C5",
    name: "web_research",
    rows: 24,
    status: "running",
  },
  {
    cellCount: 980,
    code: "C6",
    name: "classify",
    rows: 18,
    status: "running",
    width: "sm",
  },
  {
    cellCount: 1340,
    code: "C7",
    name: "extract",
    rows: 21,
    status: "running",
  },
  {
    cellCount: 2410,
    code: "C8",
    name: "translate",
    rows: 28,
    status: "running",
    width: "lg",
  },
  {
    cellCount: 720,
    code: "C9",
    name: "annotate",
    rows: 15,
    status: "idle",
    width: "sm",
  },
  {
    cellCount: 1567,
    code: "C10",
    name: "email_draft",
    rows: 22,
    status: "running",
  },
  {
    cellCount: 540,
    code: "C11",
    name: "score",
    rows: 13,
    status: "running",
  },
  {
    cellCount: 1108,
    code: "C12",
    name: "dedupe",
    rows: 19,
    status: "running",
  },
];
