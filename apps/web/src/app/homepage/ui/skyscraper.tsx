import { cx } from "@marble/ui";
import type { CSSProperties } from "react";

/**
 * Single tower in the marketing skyline. Each tower is a Marble column;
 * each window is a cell.
 *
 * Lit windows convey state:
 *   - orange = running
 *   - emerald = success / written
 *   - dim     = queued / off
 *   - red     = error (rare)
 */

type SkyscraperWindowState = "off" | "running" | "success" | "error";

export type MarketingSkyscraperProps = {
  /** Display name (rendered as a label tile on the roof). */
  name: string;
  /** Column code (e.g. "C1"). Rendered tiny below the name. */
  code?: string;
  /** Status pill on the roof. */
  status?: "running" | "queued" | "idle" | "error";
  /** Number of rows of windows (controls tower height). */
  rows: number;
  /** Window pattern — `rows * 2` entries; left then right per row. */
  pattern?: SkyscraperWindowState[];
  /** Total cell count to display under the tower. */
  cellCount?: number;
  /** Width scale — default `md`. `lg` for tall feature towers. */
  width?: "sm" | "md" | "lg";
  /** Subtle decorative rotation in degrees. */
  tilt?: number;
  className?: string;
};

const STATUS_TONE = {
  error: "bg-red-500",
  idle: "bg-zinc-500",
  queued: "bg-amber-400",
  running: "bg-orange-500 animate-marketing-led",
} as const;

const STATUS_LABEL = {
  error: "ERROR",
  idle: "IDLE",
  queued: "QUEUED",
  running: "LIVE",
} as const;

const WINDOW_STATES = {
  error: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.65)]",
  off: "bg-taupe-900/80",
  running:
    "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.75)] animate-marketing-led",
  success: "bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.55)]",
} satisfies Record<SkyscraperWindowState, string>;

const WIDTH_CLASS = {
  lg: "w-24 md:w-28",
  md: "w-16 md:w-20",
  sm: "w-12 md:w-14",
} as const;

/**
 * Single tower. Renders bottom-anchored: tall towers grow upward from
 * the same ground line. Place several in a flex row to compose a
 * skyline.
 */
const Window = ({
  state,
  delay,
}: {
  state: SkyscraperWindowState;
  delay: number;
}) => {
  const style: CSSProperties =
    state === "running"
      ? {
          animationDelay: `${delay}ms`,
        }
      : {};
  return (
    <span
      className={cx(
        "block aspect-[7/9] rounded-[1px] transition-colors",
        WINDOW_STATES[state],
      )}
      style={style}
    />
  );
};

const defaultPattern = (
  name: string,
  rows: number,
): SkyscraperWindowState[] => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const total = rows * 2;
  const out: SkyscraperWindowState[] = [];
  for (let i = 0; i < total; i++) {
    const r = ((hash + i * 2654435761) >>> 0) % 100;
    if (r < 8) out.push("off");
    else if (r < 14) out.push("off");
    else if (r < 40) out.push("success");
    else out.push("running");
  }
  return out;
};

export const MarketingSkyscraper = ({
  name,
  code,
  status = "running",
  rows,
  pattern,
  cellCount,
  width = "md",
  tilt,
  className,
}: MarketingSkyscraperProps) => {
  // Default deterministic pattern derived from the name so the same
  // tower always looks the same render-to-render (matches SSR).
  const seed = pattern ?? defaultPattern(name, rows);

  return (
    <div
      className={cx(
        "relative flex flex-col items-stretch self-end",
        WIDTH_CLASS[width],
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
      {/* Roof label */}
      <div className="-mb-px relative z-10 flex flex-col items-stretch rounded-t-xs border-2 border-taupe-100/15 border-b-0 bg-taupe-800/90 px-2 pt-2 pb-1 inset-shadow-2xs inset-shadow-white/45">
        <span className="truncate font-mono text-eyebrow-xs text-taupe-100">
          {name}
        </span>
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-[8px] text-taupe-100/40 uppercase tracking-[0.18em]">
            {code ?? "—"}
          </span>
          <span className="flex items-center gap-1">
            <span
              className={cx("size-1.5 rounded-full", STATUS_TONE[status])}
            />
            <span className="font-mono text-[8px] text-taupe-100/60 uppercase tracking-[0.18em]">
              {STATUS_LABEL[status]}
            </span>
          </span>
        </div>
      </div>

      {/* Tower body */}
      <div
        className={cx(
          "relative flex flex-1 flex-col items-stretch overflow-hidden rounded-b-xs border-2 border-taupe-100/10 bg-taupe-900",
          "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-taupe-100/15",
        )}
      >
        {/* Vertical seam suggesting structural columns */}
        <span
          aria-hidden
          className="-translate-x-1/2 pointer-events-none absolute inset-y-0 left-1/2 w-px bg-taupe-100/5"
        />
        {/* Windows */}
        <div className="flex flex-col gap-1 p-1.5">
          {Array.from({
            length: rows,
          }).map((_, rowIndex) => (
            <div
              className="grid grid-cols-2 gap-1"
              // biome-ignore lint/suspicious/noArrayIndexKey: pure layout grid
              key={rowIndex}
            >
              <Window
                delay={(rowIndex * 113) % 1800}
                state={seed[rowIndex * 2] ?? "off"}
              />
              <Window
                delay={(rowIndex * 113 + 580) % 1800}
                state={seed[rowIndex * 2 + 1] ?? "off"}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Foundation tag */}
      <div className="-mt-px relative z-10 flex items-center justify-between gap-1 rounded-b-xs border-2 border-taupe-100/15 border-t-0 bg-taupe-800/90 px-2 py-1 inset-shadow-2xs inset-shadow-white/45">
        <span className="font-mono text-[8px] text-taupe-100/45 uppercase tracking-[0.16em]">
          cells
        </span>
        <span className="font-mono text-eyebrow-xs text-taupe-100 tabular-nums">
          {(cellCount ?? rows * 2).toLocaleString()}
        </span>
      </div>
    </div>
  );
};
