import { MarketingDial, MarketingFader } from "../../../homepage/ui/dial";
import {
  MarketingKey,
  MarketingKeyBar,
  MarketingKeypad,
} from "../../../homepage/ui/keypad";
import {
  MarketingLCD,
  MarketingLCDCounter,
  MarketingLCDWaveform,
} from "../../../homepage/ui/lcd";
import { BRAND_REGISTRY } from "../../../homepage/ui/logos";
import {
  MarketingPanel,
  MarketingPanelDivider,
  MarketingPanelGrille,
  MarketingPanelLabel,
} from "../../../homepage/ui/panel";
import { Showcase } from "./chrome";

export const ControlShowcases = () => {
  return (
    <>
      <Showcase
        description={
          <>
            <code>MarketingPanel</code> is the TE-style faceplate — use
            sparingly for content that benefits from the "instrument" chrome.
            Compose with <code>PanelLabel</code>, <code>PanelDivider</code>,{" "}
            <code>PanelGrille</code>. Marble's UI is warm first, panel-y second.
          </>
        }
        id="panel"
        title="Panel"
      >
        <MarketingPanel
          brand="DEMO"
          model="EP-DEMO · 01"
          spec="SHOWCASE / 01"
          tone="dark"
        >
          <MarketingPanelLabel index="01">SECTION ONE</MarketingPanelLabel>
          <p className="mt-2 text-taupe-100">
            Body content lives in the panel — dotted backdrop, screw corners,
            registration crosshairs.
          </p>
          <MarketingPanelDivider
            className="my-5"
            label="02 / GRILLE"
          />
          <MarketingPanelGrille ratio="16/4" />
        </MarketingPanel>
      </Showcase>

      <Showcase
        description={
          <>
            <code>MarketingKeypad</code> + <code>MarketingKey</code> for chiclet
            button grids. Active key gets the orange treatment.{" "}
            <code>MarketingKeyBar</code> for wide transport-style keys.
          </>
        }
        id="keypad"
        title="Keypad"
      >
        <div className="rounded-xs border-2 border-dashed border-taupe-300 bg-taupe-900 p-6">
          <MarketingKeypad
            columns={4}
            gap="md"
          >
            <MarketingKey
              caption="claude"
              glyph={<BRAND_REGISTRY.claude.Glyph size={26} />}
              index="A1"
              led
              tone="midnight"
            />
            <MarketingKey
              active
              caption="cursor"
              glyph={<BRAND_REGISTRY.cursor.Glyph size={26} />}
              index="A2"
              led
            />
            <MarketingKey
              caption="codex"
              glyph={<BRAND_REGISTRY.codex.Glyph size={26} />}
              index="A3"
              tone="midnight"
            />
            <MarketingKey
              attention
              caption="new!"
              glyph="★"
              index="A4"
              tone="dark"
            />
          </MarketingKeypad>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <MarketingKeyBar
              caption="open · streaming"
              label="LIVE"
              led
            />
            <MarketingKeyBar
              active
              caption="play"
              label="▶ PLAY"
              led
            />
          </div>
        </div>
      </Showcase>

      <Showcase
        description={
          <>
            <code>MarketingLCD</code> is the dark display.{" "}
            <code>MarketingLCDCounter</code> live-ticks an integer.{" "}
            <code>MarketingLCDWaveform</code> is the bar oscillation.
          </>
        }
        id="lcd"
        title="LCD"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MarketingLCD
            caption="cells materialized · live"
            label="CELLS RUN"
            size="lg"
          >
            <MarketingLCDCounter
              pad={10}
              start={4_283_117}
              step={17}
              suffix="cells"
            />
          </MarketingLCD>
          <MarketingLCD
            digitTone="cream"
            label="WAVEFORM"
            size="md"
          >
            <MarketingLCDWaveform bars={32} />
          </MarketingLCD>
        </div>
      </Showcase>

      <Showcase
        description={
          <>
            <code>MarketingDial</code> is a rotary knob with tick marks and a
            pointer. <code>MarketingFader</code> is a vertical slider. Both
            accept <code>sweep</code> / <code>animate</code> for an idle-motion
            loop.
          </>
        }
        id="dial"
        title="Dial & fader"
      >
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <MarketingDial
            caption="HOT"
            label="THROUGHPUT"
            sweep
            tone="dark"
          />
          <MarketingDial
            caption="42"
            label="MIX"
            size="sm"
            tone="cream"
          />
          <div className="flex items-end justify-center">
            <MarketingFader
              animate
              caption="0.74"
              label="AI"
            />
          </div>
          <div className="flex items-end justify-center gap-3">
            <MarketingFader
              animate
              caption="0.42"
              label="CPU"
            />
            <MarketingFader
              animate
              caption="0.18"
              label="IO"
              tone="cream"
              value={0.3}
            />
          </div>
        </div>
      </Showcase>
    </>
  );
};
