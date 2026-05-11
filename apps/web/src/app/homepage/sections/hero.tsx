import Image from "next/image";
import { MarketingAnnotation, MarketingInlineWink } from "../ui/annotation";
import { MarketingCard } from "../ui/card";
import {
  MarketingDotRow,
  MarketingPin,
  MarketingStackedWordmark,
} from "../ui/mark";
import { Section } from "../ui/section";

/**
 * The Marble hero — kept deliberately warm, tactile, and posterized.
 * Uses the marketing primitives (`MarketingAnnotation`,
 * `MarketingInlineWink`, `MarketingStackedWordmark`, `MarketingPin`)
 * rather than hand-rolled chrome, so future hero tweaks live in the
 * same primitive vocabulary as the rest of the page.
 */
export function HeroSection() {
  return (
    <Section
      className="relative flex min-h-[85vh] flex-col items-start justify-end gap-8 overflow-hidden pb-0"
      tone="light"
    >
      {/* Top-left "dude" + pinned annotation */}
      <div className="relative w-full">
        <div className="-top-[200px] -left-[220px] absolute size-[500px] rotate-12 object-cover">
          <Image
            alt=""
            className="size-full object-contain"
            height={700}
            priority
            src="/example_dude_5.png"
            width={500}
          />
        </div>

        <div className="-top-[140px] absolute left-[160px] z-30">
          <MarketingAnnotation
            rotate={-4}
            size="lg"
            tail={{
              rotate: -12,
              side: "bottom",
            }}
            tone="mid"
          >
            Finally...!
          </MarketingAnnotation>
        </div>

        {/* Small spec line — Marble-flavored, not TE-instrument-y */}
        <div className="-top-2 absolute right-2 hidden flex-col items-end gap-3 md:flex">
          <MarketingPin
            rotate={8}
            tone="orange"
          >
            v0.0.1
            <br />
            open
          </MarketingPin>
          <span className="flex items-center gap-2 font-mono text-eyebrow text-taupe-700/70">
            <span className="size-1.5 animate-marketing-led rounded-full bg-orange-500" />
            EST. 2026 — MIT
          </span>
          <MarketingDotRow
            count={5}
            tone="orange"
          />
        </div>
      </div>

      {/* The big poster card — kept hand-crafted (chunky orange offset border) */}
      <MarketingCard
        accent="poster"
        className="ml-0 md:ml-64"
        tone="cream"
      >
        <p className="max-w-3xl text-5xl leading-snug text-taupe-800">
          <span className="font-medium text-orange-400">Fast,</span> reliable,
          and open GTM tooling built by{" "}
          <MarketingInlineWink
            direction="left"
            tone="taupe"
          >
            and for!
          </MarketingInlineWink>{" "}
          <strong className="underline decoration-orange-300">the best</strong>{" "}
          operators and engineers.
        </p>
      </MarketingCard>

      <div className="-left-6 -bottom-6 relative">
        <MarketingStackedWordmark
          as="h1"
          size="xl"
          tone="orange"
        >
          Marble
        </MarketingStackedWordmark>
      </div>
    </Section>
  );
}
