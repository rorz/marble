"use client";

import { cx } from "@marble/ui";
import {
  CodeIcon,
  HardDrivesIcon,
  LightningIcon,
  PlayIcon,
  RecordIcon,
  RobotIcon,
  TableIcon,
} from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { MarketingDial, MarketingFader } from "./dial";
import { MarketingKey, MarketingKeyBar, MarketingKeypad } from "./keypad";
import { MarketingLCD, MarketingLCDCounter, MarketingLCDWaveform } from "./lcd";
import {
  MarketingPanel,
  MarketingPanelDivider,
  MarketingPanelGrille,
  MarketingPanelLabel,
} from "./panel";

/**
 * The composed K.O. II homage — a "Marble device" mocked entirely in
 * CSS. Three regions: display + dial up top, keypad in the middle,
 * mixer / status at the bottom. Drop this into a splash or a section
 * to communicate the "instrument-for-agents" thesis visually.
 */

type MarketingInstrumentProps = {
  /** Top spec line (left-aligned). */
  spec?: ReactNode;
  /** Top model code (right-aligned). */
  model?: ReactNode;
  /** Big brand wordmark in the panel header. */
  brand?: ReactNode;
  /** Seed value for the headline display counter (real cell count). */
  counterSeed?: number;
  /** Label for the headline display. */
  counterLabel?: ReactNode;
  /** Suffix unit ("cells", "ms", etc.). */
  counterSuffix?: ReactNode;
  className?: string;
};

const KEYS: Array<{
  glyph: ReactNode;
  index: string;
  caption: string;
  active?: boolean;
  led?: boolean;
}> = [
  {
    caption: "table",
    glyph: (
      <TableIcon
        size={28}
        weight="bold"
      />
    ),
    index: "A1",
  },
  {
    caption: "column",
    glyph: "C",
    index: "A2",
    led: true,
  },
  {
    caption: "row",
    glyph: "R",
    index: "A3",
  },
  {
    caption: "cell",
    glyph: "·",
    index: "A4",
  },
  {
    caption: "agent",
    glyph: (
      <RobotIcon
        size={26}
        weight="bold"
      />
    ),
    index: "A5",
  },
  {
    caption: "skill",
    glyph: "S",
    index: "A6",
  },

  {
    caption: "input",
    glyph: "▸",
    index: "B1",
  },
  {
    active: true,
    caption: "output",
    glyph: "◂",
    index: "B2",
    led: true,
  },
  {
    caption: "fn",
    glyph: (
      <CodeIcon
        size={24}
        weight="bold"
      />
    ),
    index: "B3",
  },
  {
    caption: "cache",
    glyph: (
      <HardDrivesIcon
        size={24}
        weight="bold"
      />
    ),
    index: "B4",
  },
  {
    caption: "publish",
    glyph: "↑",
    index: "B5",
  },
  {
    caption: "fork",
    glyph: "⌥",
    index: "B6",
  },
];

export function MarketingInstrument({
  spec = "EP-001 / RT-MARBLE",
  model = "OSS · MIT · v0.0.1",
  brand = "MARBLE",
  counterSeed = 4_283_117,
  counterLabel = "CELLS RUN · LIVE",
  counterSuffix = "cells",
  className,
}: MarketingInstrumentProps) {
  return (
    <MarketingPanel
      brand={brand}
      className={cx("max-w-2xl", className)}
      model={model}
      spec={spec}
      tone="dark"
    >
      {/* DISPLAY + DIAL */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-3">
          <MarketingPanelLabel index="01">DISPLAY</MarketingPanelLabel>
          <MarketingLCD
            caption="cells materialized · streaming"
            label={counterLabel}
            size="lg"
          >
            <MarketingLCDCounter
              pad={10}
              start={counterSeed}
              step={17}
              suffix={counterSuffix}
            />
          </MarketingLCD>
          <MarketingLCD
            digitTone="cream"
            label="WAVEFORM · CELL OUT"
            size="sm"
          >
            <MarketingLCDWaveform bars={32} />
          </MarketingLCD>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 rounded-xs border-2 border-current/15 bg-taupe-900/40 p-4">
          <MarketingPanelLabel
            className="self-start"
            index="02"
          >
            PRIORITY
          </MarketingPanelLabel>
          <MarketingDial
            caption="HOT"
            label="03·12 RUNS"
            size="md"
            sweep
            tone="dark"
          />
        </div>
      </div>

      <MarketingPanelDivider
        className="mt-6 mb-5"
        label="03 / KIT — TABULAR"
      />

      {/* KEYPAD */}
      <MarketingKeypad
        columns={6}
        gap="md"
      >
        {KEYS.map((key) => (
          <MarketingKey
            active={key.active}
            caption={key.caption}
            glyph={key.glyph}
            index={key.index}
            key={key.index}
            led={key.led}
            size="md"
            tone="midnight"
          />
        ))}
      </MarketingKeypad>

      <MarketingPanelDivider
        className="mt-6 mb-5"
        label="04 / MIXER"
      />

      {/* MIXER */}
      <div className="grid grid-cols-[auto_1fr] gap-5">
        <div className="flex items-end gap-3">
          <MarketingFader
            animate
            caption="0.42"
            height="md"
            label="CPU"
          />
          <MarketingFader
            animate
            caption="0.74"
            height="md"
            label="AI"
            tone="cream"
            value={0.55}
          />
          <MarketingFader
            animate
            caption="0.18"
            height="md"
            label="IO"
            value={0.3}
          />
        </div>
        <div className="flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-3 rounded-xs border-2 border-current/15 bg-taupe-900/30 px-4 py-3">
            <MarketingPanelLabel index="A">TRANSPORT</MarketingPanelLabel>
            <div className="flex items-center gap-2">
              <MarketingKey
                caption="rec"
                glyph={
                  <RecordIcon
                    size={22}
                    weight="fill"
                  />
                }
                index="●"
                size="sm"
                tone="dark"
              />
              <MarketingKey
                active
                caption="play"
                glyph={
                  <PlayIcon
                    size={22}
                    weight="fill"
                  />
                }
                index="▶"
                led
                size="sm"
              />
              <MarketingKey
                caption="boost"
                glyph={
                  <LightningIcon
                    size={22}
                    weight="fill"
                  />
                }
                index="⚡"
                size="sm"
                tone="dark"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xs border-2 border-current/15 bg-taupe-900/30 px-4 py-3">
            <div className="flex flex-col gap-1">
              <MarketingPanelLabel index="B">CHANNEL OUT</MarketingPanelLabel>
              <span className="font-display font-medium text-base leading-none tracking-tight md:text-lg">
                cell stream → realtime
              </span>
            </div>
            <MarketingKeyBar
              active
              caption="open · streaming"
              label="LIVE"
              led
            />
          </div>
          <MarketingPanelGrille
            className="bg-taupe-900/40"
            ratio="16/3"
          />
        </div>
      </div>
    </MarketingPanel>
  );
}
