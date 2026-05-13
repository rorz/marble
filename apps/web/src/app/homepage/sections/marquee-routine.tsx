import { MarketingMarqueeStack } from "../ui/splash";

/**
 * Page-break marquee — a chunky, full-bleed billboard that interrupts
 * the column flow. Three offset rows in alternating tones / directions.
 */

export const MarqueeRoutineSection = () => {
  return (
    <div className="relative overflow-hidden bg-taupe-800 py-2">
      <MarketingMarqueeStack
        rows={[
          {
            direction: "left",
            phrase: "ROUTINE 01 — INSTALL",
            separator: "●",
            speed: "normal",
            tone: "orange",
          },
          {
            direction: "right",
            phrase: "bunx @marble/cli init",
            separator: "▸",
            speed: "slow",
            tone: "cream",
          },
          {
            direction: "left",
            phrase: "AGENTS · TABLES · CELLS · PROGRAMS",
            separator: "★",
            speed: "fast",
            tone: "dark",
          },
        ]}
      />
    </div>
  );
};
