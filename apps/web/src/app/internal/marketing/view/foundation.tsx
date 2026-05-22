import {
  MarketingAnnotation,
  MarketingInlineWink,
} from "../../../homepage/ui/annotation";
import {
  MarketingDotRow,
  MarketingPin,
  MarketingStackedWordmark,
} from "../../../homepage/ui/mark";
import { AnimationSwatch, Demo, Showcase } from "./chrome";

export const FoundationShowcases = () => {
  return (
    <>
      <Showcase
        description={
          <>
            Animations are declared as <code>--animate-marketing-*</code> tokens
            in <code>globals.css</code>. Each respects{" "}
            <code>prefers-reduced-motion</code>.
          </>
        }
        id="tokens"
        title="Tokens & motion"
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <AnimationSwatch
            cls="animate-marketing-led"
            label="led"
            swatch
          />
          <AnimationSwatch
            cls="animate-marketing-lcd"
            label="lcd"
            text
          />
          <AnimationSwatch
            cls="animate-marketing-float"
            label="float"
            swatch
          />
          <AnimationSwatch
            cls="animate-marketing-tick"
            label="tick"
            swatch
          />
          <AnimationSwatch
            cls="animate-marketing-pulse-ring"
            label="pulse-ring"
            swatch
          />
          <AnimationSwatch
            cls="animate-marketing-rise"
            label="rise"
            swatch
          />
          <AnimationSwatch
            cls="animate-marketing-glow"
            label="glow"
            swatch
          />
          <AnimationSwatch
            cls="animate-marketing-marquee"
            label="marquee"
            text
          />
        </div>
        <Demo
          description="The marketing grid background and scanline utilities."
          label="Backdrops"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="marketing-grid-bg-dark h-24 rounded-xs border-2 border-taupe-300 bg-taupe-200" />
            <div className="marketing-grid-bg h-24 rounded-xs border-2 border-taupe-900 bg-taupe-900" />
            <div className="marketing-scanlines marketing-lcd-screen h-24 rounded-xs border-2 border-taupe-900" />
          </div>
        </Demo>
      </Showcase>

      <Showcase
        description={
          <>
            <code>MarketingStackedWordmark</code> renders the layered wordmark
            used in the hero. <code>MarketingInlineWink</code> is the rotated
            inline emphasis.
          </>
        }
        id="type"
        title="Type & wordmark"
      >
        <Demo label="MarketingStackedWordmark · md / orange">
          <MarketingStackedWordmark size="md">Marble</MarketingStackedWordmark>
        </Demo>
        <Demo
          contained={false}
          label="MarketingStackedWordmark · xl on dark"
        >
          <div className="overflow-hidden rounded-xs border-2 border-taupe-300 bg-taupe-900 p-10">
            <MarketingStackedWordmark
              size="lg"
              tone="orange"
            >
              Marble
            </MarketingStackedWordmark>
          </div>
        </Demo>
        <Demo label="MarketingInlineWink · inline emphasis">
          <p className="text-3xl text-taupe-800 leading-snug">
            Built for the{" "}
            <MarketingInlineWink
              direction="left"
              tone="orange"
            >
              operators
            </MarketingInlineWink>{" "}
            and{" "}
            <MarketingInlineWink
              direction="right"
              tone="taupe"
            >
              engineers!
            </MarketingInlineWink>
          </p>
        </Demo>
      </Showcase>

      <Showcase
        description={
          <>
            <code>MarketingAnnotation</code> is a sticker / speech-bubble
            overlay. <code>MarketingPin</code> is the circular badge.{" "}
            <code>MarketingDotRow</code> is a rhythm break.
          </>
        }
        id="stickers"
        title="Stickers, pins, dots"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Demo label="MarketingAnnotation · mid · md · tail">
            <MarketingAnnotation
              rotate={-4}
              size="md"
              tail={{
                rotate: -12,
                side: "bottom",
              }}
              tone="mid"
            >
              Finally...!
            </MarketingAnnotation>
          </Demo>
          <Demo label="MarketingAnnotation · orange · sm">
            <MarketingAnnotation
              rotate={4}
              size="sm"
              tone="orange"
            >
              agent-shaped
            </MarketingAnnotation>
          </Demo>
        </div>
        <Demo label="MarketingPin · 3 tones">
          <div className="flex flex-wrap items-center gap-4">
            <MarketingPin
              rotate={-8}
              tone="orange"
            >
              MIT
              <br />
              license
            </MarketingPin>
            <MarketingPin
              rotate={6}
              tone="cream"
            >
              free
              <br />
              self-host
            </MarketingPin>
            <MarketingPin tone="dark">v1.0</MarketingPin>
          </div>
        </Demo>
        <Demo label="MarketingDotRow · 5 dots">
          <MarketingDotRow
            count={5}
            tone="orange"
          />
        </Demo>
      </Showcase>
    </>
  );
};
