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
 */
export function MsBurnedSplashSection() {
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
              caption="rolling 24h · streaming"
              label="MS BURNED · GLOBAL"
              size="xl"
            >
              <MarketingLCDCounter
                pad={12}
                start={812_447_318}
                step={97}
                suffix="ms"
              />
            </MarketingLCD>
          </div>

          <div className="flex flex-col gap-3">
            <MarketingTicker
              label="CELLS / SEC"
              pad={5}
              progress
              start={142}
              step="random"
              suffix="cells"
            />
            <MarketingTicker
              label="PROGRAMS RUNNING"
              pad={4}
              progress
              start={37}
              step={1}
              suffix="prg"
              tone="cream"
            />
            <MarketingTicker
              label="EDGE ISOLATES"
              pad={4}
              progress
              start={1184}
              step="random"
              suffix="iso"
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
