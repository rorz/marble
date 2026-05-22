import {
  MarketingCard,
  MarketingCardBody,
  MarketingCardEyebrow,
  MarketingCardTitle,
} from "../../../homepage/ui/card";
import { MarketingInstrument } from "../../../homepage/ui/instrument";
import {
  Section as MarketingSection,
  SectionHeader as MarketingSectionHeader,
  SectionInner as MarketingSectionInner,
} from "../../../homepage/ui/section";
import {
  MARKETING_SKYLINE_DEMO,
  MarketingSkyline,
  MarketingSkyscraper,
} from "../../../homepage/ui/skyline";
import { MarketingTicker } from "../../../homepage/ui/ticker";
import { MarketingTiltCard } from "../../../homepage/ui/tilt-card";
import { Demo, Showcase } from "./chrome";

export const MotionShowcases = () => {
  return (
    <>
      <Showcase
        description={
          <>
            <code>MarketingTicker</code> = labeled live-counter with LED +
            progress bar. Used inside splashes for "live platform" feel.
          </>
        }
        id="ticker"
        title="Ticker"
      >
        <div className="grid grid-cols-1 gap-3 rounded-xs border-2 border-dashed border-taupe-300 bg-taupe-900 p-6 md:grid-cols-3">
          <MarketingTicker
            label="CELLS / SEC"
            pad={5}
            start={142}
            step="random"
            suffix="cells"
          />
          <MarketingTicker
            label="PROGRAMS"
            pad={4}
            start={37}
            step={1}
            suffix="prg"
            tone="cream"
          />
          <MarketingTicker
            label="EDGE ISOLATES"
            pad={4}
            start={1184}
            step="random"
            suffix="iso"
          />
        </div>
      </Showcase>

      <Showcase
        description={
          <>
            <code>MarketingTiltCard</code> wraps any content in CSS-3D
            pointer-tracking. Move the mouse over the card.
          </>
        }
        id="tilt"
        title="Tilt (CSS 3D)"
      >
        <Demo label="Hover & move pointer">
          <div className="flex justify-center">
            <MarketingTiltCard
              className="w-72"
              maxTilt={14}
            >
              <MarketingCard
                accent="poster"
                tone="cream"
              >
                <MarketingCardEyebrow>Tilt me</MarketingCardEyebrow>
                <MarketingCardTitle>Move pointer →</MarketingCardTitle>
                <MarketingCardBody>
                  Pointer-tracking 3D card. Glare follows the cursor.
                </MarketingCardBody>
              </MarketingCard>
            </MarketingTiltCard>
          </div>
        </Demo>
      </Showcase>

      <Showcase
        description={
          <>
            <code>MarketingSkyline</code> renders columns-as-towers with
            cells-as-windows. Lit orange = running, lit emerald = materialized.
            Hands-down the Marble visual.
          </>
        }
        id="skyline"
        title="Skyline"
      >
        <Demo
          description="A single tower with default pattern."
          label="MarketingSkyscraper · single"
        >
          <div className="flex justify-center">
            <MarketingSkyscraper
              cellCount={1248}
              code="C1"
              name="lead_score"
              rows={20}
              status="running"
              width="md"
            />
          </div>
        </Demo>
        <Demo
          contained={false}
          description="The composed skyline as it appears in the splash."
          label="MarketingSkyline · full demo fleet"
        >
          <div className="-mx-6 overflow-hidden bg-taupe-900 px-2 pt-12 pb-2 md:-mx-10">
            <MarketingSkyline buildings={MARKETING_SKYLINE_DEMO} />
          </div>
        </Demo>
      </Showcase>

      <Showcase
        description={
          <>
            <code>MarketingInstrument</code> is the composed K.O. II homage —
            panel + keypad + LCD + dial + faders. Use sparingly — Marble is
            warm-first, panel-y second.
          </>
        }
        id="instrument"
        title="Instrument (composed)"
      >
        <div className="rounded-xs border-2 border-dashed border-taupe-300 bg-taupe-900 p-6">
          <div className="mx-auto max-w-xl">
            <MarketingInstrument />
          </div>
        </div>
      </Showcase>

      <Showcase
        description={
          <>
            <code>Section</code> + <code>SectionHeader</code> +{" "}
            <code>SectionInner</code> are the page-level container primitives.
            Tones map onto the homepage palette.
          </>
        }
        id="section-chrome"
        title="Section chrome"
      >
        <div className="-mx-6 md:-mx-10">
          <MarketingSection tone="darkest">
            <MarketingSectionInner width="normal">
              <MarketingSectionHeader
                eyebrow="Section eyebrow"
                eyebrowTone="orange"
                heading={
                  <>
                    A section heading
                    <br />
                    in the <span className="text-orange-400">wild</span>.
                  </>
                }
                lede="With a lede paragraph below. Section header sets typography rhythm for every part of the page."
              />
            </MarketingSectionInner>
          </MarketingSection>
        </div>
      </Showcase>
    </>
  );
};
