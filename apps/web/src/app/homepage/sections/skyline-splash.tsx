import { LightningIcon } from "@phosphor-icons/react/ssr";
import {
  MARKETING_SKYLINE_DEMO,
  MarketingSkyline,
  type MarketingSkyscraperProps,
} from "../ui/skyline";
import {
  MarketingMarquee,
  MarketingSplash,
  MarketingSplashContent,
  MarketingSplashSpec,
  MarketingSplashTitle,
} from "../ui/splash";

/**
 * Columns-as-skyscrapers — the program-model thesis rendered as a
 * full-bleed city silhouette. Towers are columns; their windows are
 * cells. Lit orange = running, lit emerald = success, dim = off.
 *
 * Place after the program-model section so the visual lands the
 * thesis just stated.
 */

type SkylineSplashSectionProps = {
  /** Real-platform skyline (seeded from `getMarketingSkyline`). */
  buildings?: MarketingSkyscraperProps[];
  /** Real-platform total cells, used in the eyebrow spec line. */
  totalCells?: number;
  /** Real-platform total programs. */
  totalPrograms?: number;
};

export function SkylineSplashSection({
  buildings = MARKETING_SKYLINE_DEMO,
  totalCells,
  totalPrograms,
}: SkylineSplashSectionProps = {}) {
  const programCount = totalPrograms ?? buildings.length;
  return (
    <div className="relative bg-taupe-900">
      <MarketingMarquee
        direction="left"
        phrase="LIVE COLUMNS · STREAMING CELLS · ALWAYS RUNNING"
        separator="●"
        speed="slow"
        tone="dark"
      />

      <MarketingSplash
        className="relative overflow-hidden"
        height="tall"
        tone="darkest"
        veil="none"
      >
        {/* Night sky — radial fade from horizon */}
        <div
          aria-hidden
          className="-z-10 pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 100%, rgba(249,115,22,0.32) 0%, rgba(249,115,22,0.08) 20%, transparent 50%), linear-gradient(180deg, #0a0908 0%, #1a1411 60%, #2b1f17 100%)",
          }}
        />
        {/* Star dust */}
        <div
          aria-hidden
          className="-z-10 marketing-grid-bg pointer-events-none absolute inset-0 opacity-40"
        />

        <MarketingSplashContent
          align="center"
          className="relative gap-6 pb-0 md:gap-8 md:pb-0"
        >
          <MarketingSplashSpec className="text-orange-300">
            <LightningIcon
              size={12}
              weight="bold"
            />
            COLUMN GRAPH · LIVE · {programCount.toLocaleString()} PROGRAMS
            RUNNING
          </MarketingSplashSpec>

          <MarketingSplashTitle
            className="text-balance"
            size="md"
          >
            Your columns
            <br />
            <span className="text-orange-400">are alive.</span>
          </MarketingSplashTitle>

          <p className="max-w-2xl text-balance text-lg text-taupe-100/75 md:text-2xl">
            Every column is a small program. Every cell is a window into its
            run. The whole graph re-evaluates the moment upstream cells change —
            towers light up as the workspace breathes.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 font-mono text-eyebrow-xs">
            <span className="flex items-center gap-2 rounded-full border-2 border-orange-500/50 bg-orange-500/10 px-3 py-1 text-orange-300">
              <span className="size-1.5 rounded-full bg-orange-500 animate-marketing-led" />
              RUNNING
            </span>
            <span className="flex items-center gap-2 rounded-full border-2 border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-200">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              MATERIALIZED
            </span>
            <span className="flex items-center gap-2 rounded-full border-2 border-taupe-100/15 px-3 py-1 text-taupe-100/60">
              <span className="size-1.5 rounded-full bg-taupe-100/40" />
              QUEUED / IDLE
            </span>
            {totalCells !== undefined ? (
              <span className="flex items-center gap-2 rounded-full border-2 border-taupe-100/15 bg-taupe-900/50 px-3 py-1 text-taupe-100/80">
                <span className="font-mono tabular-nums">
                  {totalCells.toLocaleString()}
                </span>
                CELLS LIVE
              </span>
            ) : null}
          </div>
        </MarketingSplashContent>

        {/* Skyline anchored to the bottom, full-bleed */}
        <div className="relative mt-6 w-full">
          <MarketingSkyline buildings={buildings} />
        </div>
      </MarketingSplash>

      <MarketingMarquee
        direction="right"
        phrase="ONE COLUMN · ONE PROGRAM · ONE GRAPH"
        separator="✦"
        speed="normal"
        tone="orange"
      />
    </div>
  );
}
