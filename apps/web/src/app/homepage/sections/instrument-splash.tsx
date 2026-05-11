import { MarketingInstrument } from "../ui/instrument";
import {
  MarketingSplash,
  MarketingSplashContent,
  MarketingSplashSpec,
  MarketingSplashTitle,
} from "../ui/splash";
import { MarketingTiltCard } from "../ui/tilt-card";

/**
 * The K.O. II homage — a fake-hardware "Marble device" rendered in
 * CSS, floating in 3D inside a full-bleed splash. Carries the agentic
 * thesis on the left, the device on the right.
 */
export function InstrumentSplashSection() {
  return (
    <MarketingSplash
      height="tall"
      tone="darkest"
      veil="vignette"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 marketing-grid-bg"
      />
      <MarketingSplashContent
        align="start"
        className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16"
      >
        <div className="flex flex-col gap-6">
          <MarketingSplashSpec>
            EP-001 · MARBLE · TABULAR INSTRUMENT FOR AGENTS
          </MarketingSplashSpec>
          <MarketingSplashTitle size="md">
            An instrument for <span className="text-orange-400">runtime</span>.
          </MarketingSplashTitle>
          <p className="max-w-md text-lg text-taupe-100/80 md:text-xl">
            Tables, programs, and cells laid out on the same panel — every input
            is a key, every output is a cell, and the whole thing scrubs in real
            time.
          </p>
          <div className="flex flex-wrap items-center gap-3 font-mono text-eyebrow-xs text-taupe-100/60">
            <span className="rounded-full border-2 border-orange-500/60 px-3 py-1 text-orange-300">
              REALTIME
            </span>
            <span className="rounded-full border-2 border-taupe-100/20 px-3 py-1">
              EDGE EXEC
            </span>
            <span className="rounded-full border-2 border-taupe-100/20 px-3 py-1">
              PROGRAM-NATIVE
            </span>
          </div>
        </div>

        <div className="relative flex justify-end">
          <MarketingTiltCard
            className="w-full md:w-[110%]"
            float
            maxTilt={8}
          >
            <MarketingInstrument />
          </MarketingTiltCard>
        </div>
      </MarketingSplashContent>
    </MarketingSplash>
  );
}
