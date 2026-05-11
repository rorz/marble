import { LightningIcon, TimerIcon } from "@phosphor-icons/react/ssr";
import {
  MarketingLCD,
  MarketingLCDCounter,
  MarketingLCDWaveform,
} from "../ui/lcd";
import {
  MarketingMarquee,
  MarketingSplash,
  MarketingSplashContent,
  MarketingSplashSpec,
  MarketingSplashTitle,
} from "../ui/splash";
import { MarketingTicker } from "../ui/ticker";

/**
 * "Live compute burn" page-break. A dark splash with a giant LCD on
 * the left and three live tickers on the right. The whole thing
 * communicates "you only pay for the milliseconds you actually use".
 *
 * Seeds the counters from real platform totals when supplied.
 */

type MsBurnedSplashSectionProps = {
  /** Real platform totals — seed the headline counter. */
  totalCells?: number;
  /** Total program runs ever recorded. */
  totalRuns?: number;
  /** Total platform agents. */
  totalAgents?: number;
};

export function MsBurnedSplashSection({
  totalCells,
  totalRuns,
  totalAgents,
}: MsBurnedSplashSectionProps = {}) {
  // Seed the headline counter from real cell count when available.
  // Otherwise fall back to an evocative starting integer.
  const cellsSeed = totalCells ?? 8_124_473;
  const runsSeed = totalRuns ?? 37;
  const agentsSeed = totalAgents ?? 1184;

  return (
    <div className="bg-taupe-900">
      <MarketingMarquee
        direction="right"
        phrase="MS · MS · MS · ONLY MILLISECONDS"
        separator="●"
        speed="fast"
        tone="orange"
      />

      <MarketingSplash
        className="border-y-2 border-taupe-900"
        height="md"
        tone="darkest"
        veil="orange"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 marketing-grid-bg"
        />
        <MarketingSplashContent
          align="start"
          className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.4fr_1fr] md:gap-16"
        >
          <div className="flex flex-col gap-6">
            <MarketingSplashSpec>
              <TimerIcon
                size={12}
                weight="bold"
              />
              METER · WORKSPACE · LIVE
            </MarketingSplashSpec>
            <MarketingSplashTitle size="md">
              Every cell is a tiny
              <br />
              <span className="text-orange-400">unit of compute.</span>
            </MarketingSplashTitle>
            <MarketingLCD
              caption="cells materialized · platform-wide · live"
              label="CELLS RUN · GLOBAL"
              size="xl"
            >
              <MarketingLCDCounter
                pad={12}
                start={cellsSeed}
                step={17}
                suffix="cells"
              />
            </MarketingLCD>
          </div>

          <div className="flex flex-col gap-3">
            <MarketingTicker
              label="CELLS / SEC"
              pad={5}
              progress
              start={Math.min(
                9999,
                Math.max(40, Math.floor(cellsSeed / 86400)),
              )}
              step="random"
              suffix="cells"
            />
            <MarketingTicker
              label="RUNS RECORDED"
              pad={6}
              progress
              start={runsSeed}
              step={1}
              suffix="runs"
              tone="cream"
            />
            <MarketingTicker
              label="AGENTS ON PLATFORM"
              pad={4}
              progress
              start={agentsSeed}
              step="random"
              suffix="agents"
            />
            <div className="flex items-center gap-3 rounded-xs border-2 border-orange-500/30 bg-orange-500/10 px-4 py-3 font-mono text-eyebrow text-orange-300">
              <LightningIcon
                size={14}
                weight="fill"
              />
              IDLE = 0ms = $0
            </div>
          </div>
        </MarketingSplashContent>
        <div className="-z-10 absolute right-10 bottom-6 hidden md:block">
          <MarketingLCDWaveform
            bars={48}
            className="h-12 w-72 opacity-50"
          />
        </div>
      </MarketingSplash>

      <MarketingMarquee
        direction="left"
        phrase="NOT SEATS · NOT CREDITS · NOT TIERS"
        separator="✕"
        speed="normal"
        tone="dark"
      />
    </div>
  );
}
