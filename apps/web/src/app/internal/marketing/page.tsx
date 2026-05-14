"use client";

// harness-ignore: max-file-lines -- internal marketing primitive catalog; matches internal/ui/page.tsx opt-out pattern (single linear showcase, not a user-facing route)

import {
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
} from "@marble/ui";
import { GithubLogoIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import {
  MarketingAnnotation,
  MarketingInlineWink,
} from "../../homepage/ui/annotation";
import {
  MarketingCard,
  MarketingCardBody,
  MarketingCardContent,
  MarketingCardEyebrow,
  MarketingCardFooter,
  MarketingCardGlyph,
  MarketingCardGrid,
  MarketingCardPill,
  MarketingCardTitle,
  MarketingPoster,
} from "../../homepage/ui/card";
import {
  MarketingCodeBlock,
  MarketingCodeMark,
} from "../../homepage/ui/code-block";
import {
  MarketingDiagram,
  MarketingDiagramArrow,
  MarketingDiagramNode,
} from "../../homepage/ui/diagram";
import { MarketingDial, MarketingFader } from "../../homepage/ui/dial";
import {
  MarketingFooterColumn,
  MarketingFooterGrid,
} from "../../homepage/ui/footer-grid";
import { MarketingInstrument } from "../../homepage/ui/instrument";
import {
  MarketingKey,
  MarketingKeyBar,
  MarketingKeypad,
} from "../../homepage/ui/keypad";
import {
  MarketingLCD,
  MarketingLCDCounter,
  MarketingLCDWaveform,
} from "../../homepage/ui/lcd";
import {
  MarketingLogoMark,
  MarketingLogoStrip,
} from "../../homepage/ui/logo-strip";
import { BRAND_REGISTRY, type BrandId } from "../../homepage/ui/logos";
import {
  MarketingDotRow,
  MarketingPin,
  MarketingStackedWordmark,
} from "../../homepage/ui/mark";
import {
  MarketingPanel,
  MarketingPanelDivider,
  MarketingPanelGrille,
  MarketingPanelLabel,
} from "../../homepage/ui/panel";
import {
  Section as MarketingSection,
  SectionHeader as MarketingSectionHeader,
  SectionInner as MarketingSectionInner,
} from "../../homepage/ui/section";
import {
  MARKETING_SKYLINE_DEMO,
  MarketingSkyline,
  MarketingSkyscraper,
} from "../../homepage/ui/skyline";
import {
  MarketingMarqueeStack,
  MarketingSplash,
  MarketingSplashContent,
  MarketingSplashSpec,
  MarketingSplashTitle,
} from "../../homepage/ui/splash";
import { MarketingStat, MarketingStatGrid } from "../../homepage/ui/stat";
import { MarketingTicker } from "../../homepage/ui/ticker";
import { MarketingTile } from "../../homepage/ui/tile";
import { MarketingTiltCard } from "../../homepage/ui/tilt-card";

/**
 * Marketing primitive showcase. Marble's marketing layer lives in
 * `apps/web/src/app/homepage/ui/*` and is intentionally separate from
 * the app's `@marble/ui` design system (see `AGENTS.md` rule 7).
 *
 * This page is the living catalog — every marketing primitive demoed
 * in one place, so design iterations have a fixed reference surface.
 */

const SECTIONS = [
  {
    id: "tokens",
    label: "Tokens & motion",
  },
  {
    id: "type",
    label: "Type & wordmark",
  },
  {
    id: "stickers",
    label: "Stickers",
  },
  {
    id: "cards",
    label: "Cards & posters",
  },
  {
    id: "tiles",
    label: "Tiles",
  },
  {
    id: "stats",
    label: "Stats",
  },
  {
    id: "code",
    label: "Code blocks",
  },
  {
    id: "logos",
    label: "Logos & brand glyphs",
  },
  {
    id: "diagram",
    label: "Diagrams",
  },
  {
    id: "footer",
    label: "Footer grid",
  },
  {
    id: "marquee",
    label: "Marquees",
  },
  {
    id: "splash",
    label: "Splashes",
  },
  {
    id: "panel",
    label: "Panel",
  },
  {
    id: "keypad",
    label: "Keypad",
  },
  {
    id: "lcd",
    label: "LCD",
  },
  {
    id: "dial",
    label: "Dial & fader",
  },
  {
    id: "ticker",
    label: "Ticker",
  },
  {
    id: "tilt",
    label: "Tilt (CSS 3D)",
  },
  {
    id: "skyline",
    label: "Skyline",
  },
  {
    id: "instrument",
    label: "Instrument (composed)",
  },
] as const;

const Showcase = ({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) => {
  return (
    <section
      className="scroll-mt-6"
      id={id}
    >
      <MarbleCard>
        <MarbleCardHeader className="gap-1 pb-4">
          <MarbleCardTitle className="text-lg text-taupe-950">
            {title}
          </MarbleCardTitle>
          <MarbleCardDescription className="max-w-3xl text-taupe-600">
            {description}
          </MarbleCardDescription>
        </MarbleCardHeader>
        <MarbleCardContent className="space-y-6 pt-5">
          {children}
        </MarbleCardContent>
      </MarbleCard>
    </section>
  );
};

const Demo = ({
  label,
  description,
  contained = true,
  children,
}: {
  label: string;
  description?: string;
  /** Wrap demo in a framed container. */
  contained?: boolean;
  children: ReactNode;
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-eyebrow text-taupe-700">{label}</span>
        {description ? (
          <span className="text-sm text-taupe-600">{description}</span>
        ) : null}
      </div>
      {contained ? (
        <div className="rounded-xs border-2 border-dashed border-taupe-300 bg-taupe-50 p-6">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
};

const AnimationSwatch = ({
  cls,
  label,
  swatch,
  text,
}: {
  cls: string;
  label: string;
  swatch?: boolean;
  text?: boolean;
}) => {
  return (
    <div className="flex flex-col gap-2 rounded-xs border-2 border-taupe-300 bg-taupe-50 p-4">
      <span className="font-mono text-eyebrow-xs text-taupe-700">{label}</span>
      <div className="flex h-12 items-center justify-center rounded-xs border border-taupe-200 bg-taupe-100">
        {swatch ? (
          <span className={`block size-4 rounded-full bg-orange-500 ${cls}`} />
        ) : null}
        {text ? (
          <span className={`font-mono text-base text-orange-500 ${cls}`}>
            0420
          </span>
        ) : null}
      </div>
      <code className="break-all font-mono text-[10px] text-taupe-500">
        {cls}
      </code>
    </div>
  );
};

const MarketingShowcasePage = () => {
  return (
    <main className="min-h-screen bg-taupe-100">
      <header className="border-b-2 border-taupe-300 bg-taupe-50 px-6 py-8 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <span className="font-mono text-eyebrow text-taupe-700">
            INTERNAL · MARKETING UI CATALOG
          </span>
          <h1 className="font-display font-medium text-5xl tracking-tight text-taupe-950 md:text-7xl">
            Marketing primitives
          </h1>
          <p className="max-w-2xl text-base text-taupe-700 md:text-lg">
            Every primitive from{" "}
            <MarketingCodeMark>
              apps/web/src/app/homepage/ui/*
            </MarketingCodeMark>
            demoed in one place. Distinct from{" "}
            <a
              className="underline decoration-orange-400 underline-offset-2 hover:text-orange-600"
              href="/internal/ui"
            >
              /internal/ui
            </a>{" "}
            (the app design system). Marketing primitives live{" "}
            <strong>outside</strong> <code>@marble/ui</code> by convention (see{" "}
            <code>AGENTS.md</code> rule 7).
          </p>
          <nav className="flex flex-wrap gap-2">
            {SECTIONS.map((section) => (
              <a
                className="rounded-full border-2 border-taupe-300 bg-taupe-100 px-3 py-1 font-mono text-eyebrow-xs text-taupe-700 transition-colors hover:border-orange-500 hover:bg-orange-100 hover:text-orange-700"
                href={`#${section.id}`}
                key={section.id}
              >
                {section.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 md:px-10">
        {/* ====================== TOKENS ====================== */}
        <Showcase
          description={
            <>
              Animations are declared as <code>--animate-marketing-*</code>{" "}
              tokens in <code>globals.css</code>. Each respects{" "}
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

        {/* ====================== TYPE ====================== */}
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
            <MarketingStackedWordmark size="md">
              Marble
            </MarketingStackedWordmark>
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

        {/* ====================== STICKERS ====================== */}
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

        {/* ====================== CARDS ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingCard</code> is the tactile poster. Compose with{" "}
              <code>Eyebrow</code> / <code>Title</code> / <code>Body</code> /{" "}
              <code>Footer</code> / <code>Glyph</code> / <code>Pill</code>. Use{" "}
              <code>MarketingPoster</code> for visual exhibits.
            </>
          }
          id="cards"
          title="Cards & posters"
        >
          <MarketingCardGrid
            columns={3}
            gap="md"
          >
            <MarketingCard
              accent="poster"
              tone="cream"
            >
              <MarketingCardEyebrow>Option A</MarketingCardEyebrow>
              <MarketingCardContent>
                <MarketingCardGlyph>
                  <GithubLogoIcon size={22} />
                </MarketingCardGlyph>
                <MarketingCardTitle>Poster accent.</MarketingCardTitle>
                <MarketingCardBody>
                  Thick offset orange border — the canonical Marble move.
                </MarketingCardBody>
                <MarketingCardFooter>
                  <MarketingCardPill>Open</MarketingCardPill>
                  <MarketingCardPill tone="neutral">v1.0</MarketingCardPill>
                </MarketingCardFooter>
              </MarketingCardContent>
            </MarketingCard>
            <MarketingCard tone="dark">
              <MarketingCardEyebrow>Option B</MarketingCardEyebrow>
              <MarketingCardTitle>Dark.</MarketingCardTitle>
              <MarketingCardBody>
                Same composition, inverted palette.
              </MarketingCardBody>
            </MarketingCard>
            <MarketingCard
              accent="bottom"
              tone="orange"
            >
              <MarketingCardTitle>Loud.</MarketingCardTitle>
              <MarketingCardBody>
                The full orange surface variant — use sparingly for high impact.
              </MarketingCardBody>
            </MarketingCard>
          </MarketingCardGrid>
          <Demo
            description="The bordered figure used for visual exhibits — fake screenshots, schematic mocks."
            label="MarketingPoster"
          >
            <MarketingPoster caption="leads.marble · live demo">
              <div className="flex h-40 items-center justify-center bg-taupe-200 font-display font-medium text-3xl text-taupe-700">
                figure
              </div>
            </MarketingPoster>
          </Demo>
        </Showcase>

        {/* ====================== TILES ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingTile</code> is the feature-grid card. Accepts a
              glyph, ordinal index, eyebrow, title, body, footer.
            </>
          }
          id="tiles"
          title="Tiles"
        >
          <MarketingCardGrid columns={3}>
            <MarketingTile
              body="Drop in a skill folder and any compatible agent picks up Marble's surface, semantics, and live state."
              eyebrow="Skills"
              index="01"
              title="A folder, a contract"
              tone="dark"
            />
            <MarketingTile
              body="Plugins extend any column or table. Versioned, reviewable, operator-installable."
              eyebrow="Plugins"
              index="02"
              title="Extension shapes"
              tone="cream"
            />
            <MarketingTile
              body="Marble's tabular interface, handed to your agents."
              emphasize
              eyebrow="Tabular"
              index="03"
              title="Rows × Columns × Cells"
              tone="midnight"
            />
          </MarketingCardGrid>
        </Showcase>

        {/* ====================== STATS ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingStat</code> is a display-font stat. Use{" "}
              <code>MarketingStatGrid</code> as the row.
            </>
          }
          id="stats"
          title="Stats"
        >
          <MarketingStatGrid columns={3}>
            <MarketingStat
              caption="Every line of the platform, on GitHub, from day one."
              label="License"
              tone="orange"
              value="MIT"
            />
            <MarketingStat
              caption="Run it locally, in your VPC, or on our hosted plane."
              label="Self-host"
              tone="taupe"
              value="Yours."
            />
            <MarketingStat
              caption="No license keys, no seat counts, no per-vendor surprises."
              label="Lock-in"
              value={
                <span className="text-orange-500 line-through decoration-orange-300 decoration-[6px]">
                  Zero
                </span>
              }
            />
          </MarketingStatGrid>
        </Showcase>

        {/* ====================== CODE ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingCodeBlock</code> is the marketing-styled terminal /
              source preview. Has window chrome, prompt prefix, size variants.
            </>
          }
          id="code"
          title="Code blocks"
        >
          <Demo label="With prompt, title, trailing">
            <MarketingCodeBlock
              prompt="$"
              size="lg"
              title="install marble"
              tone="midnight"
              trailing="bunx → 30s"
            >
              {`bunx @marble/cli init my-workspace
cd my-workspace
bun run dev`}
            </MarketingCodeBlock>
          </Demo>
          <Demo label="Source · cream tone">
            <MarketingCodeBlock
              size="sm"
              title="lead_score.ts"
              tone="cream"
            >
              {`export default program({
  inputs: { company: "string" },
  output: "number",
});`}
            </MarketingCodeBlock>
          </Demo>
        </Showcase>

        {/* ====================== LOGOS ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingLogoStrip</code> + <code>MarketingLogoMark</code>{" "}
              for "works with" / "powered by" attribution. Brand glyphs from the
              registry below.
            </>
          }
          id="logos"
          title="Logo strip + brand glyphs"
        >
          <Demo
            contained={false}
            label="MarketingLogoStrip · cream provider tiles"
          >
            <div className="rounded-xs border-2 border-dashed border-taupe-300 bg-taupe-50 p-6">
              <MarketingLogoStrip label="Drop-in providers">
                {(
                  [
                    "openai",
                    "anthropic",
                    "google",
                    "mistral",
                    "groq",
                  ] as const
                ).map((id) => {
                  const entry = BRAND_REGISTRY[id];
                  const Glyph = entry.Glyph;
                  return (
                    <MarketingLogoMark
                      glyph={
                        <Glyph
                          className="text-taupe-800"
                          size={20}
                        />
                      }
                      key={id}
                      name={entry.name}
                      size="sm"
                      tone="light"
                    />
                  );
                })}
              </MarketingLogoStrip>
            </div>
          </Demo>
          <Demo
            description="Every brand glyph in BRAND_REGISTRY at default tone."
            label="Brand glyphs catalog"
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(Object.keys(BRAND_REGISTRY) as BrandId[]).map((id) => {
                const entry = BRAND_REGISTRY[id];
                const Glyph = entry.Glyph;
                return (
                  <div
                    className="flex items-center gap-3 rounded-xs border-2 border-taupe-300 bg-taupe-50 px-4 py-3"
                    key={id}
                  >
                    <span className="flex size-9 items-center justify-center rounded-full border-2 border-taupe-300 bg-taupe-900">
                      <Glyph
                        className={entry.tone}
                        size={20}
                      />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-display font-medium text-base text-taupe-900 leading-none">
                        {entry.name}
                      </span>
                      <span className="font-mono text-eyebrow-xs text-taupe-500">
                        {id}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Demo>
        </Showcase>

        {/* ====================== DIAGRAM ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingDiagram</code> renders a flow of <code>Node</code>s
              connected by <code>Arrow</code>s. Pure CSS, no SVG.
            </>
          }
          id="diagram"
          title="Diagrams"
        >
          <div className="rounded-xs border-2 border-dashed border-taupe-300 bg-taupe-900 p-6 text-taupe-100">
            <MarketingDiagram>
              <MarketingDiagramNode
                body="The container — a typed surface with rows."
                eyebrow="01"
                label="Table"
                tone="dark"
              />
              <MarketingDiagramArrow direction="right" />
              <MarketingDiagramNode
                body="A column is a program — pure, reproducible."
                eyebrow="02"
                label="Column"
                tone="orange"
              />
              <MarketingDiagramArrow
                direction="right"
                label="materialize"
              />
              <MarketingDiagramNode
                body="Cells materialize when a column runs against a row."
                eyebrow="03"
                label="Cell"
                tone="dark"
              />
            </MarketingDiagram>
          </div>
        </Showcase>

        {/* ====================== FOOTER ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingFooterGrid</code> +{" "}
              <code>MarketingFooterColumn</code>. Plain link lists with eyebrow
              heading.
            </>
          }
          id="footer"
          title="Footer grid"
        >
          <div className="rounded-xs border-2 border-dashed border-taupe-300 bg-taupe-900 p-6 text-taupe-100">
            <MarketingFooterGrid>
              <MarketingFooterColumn
                heading="Product"
                links={[
                  {
                    href: "#",
                    label: "Programs",
                  },
                  {
                    href: "#",
                    label: "Tables",
                  },
                  {
                    href: "#",
                    label: "Agents",
                  },
                ]}
              />
              <MarketingFooterColumn
                heading="Resources"
                links={[
                  {
                    href: "#",
                    label: "Docs",
                  },
                  {
                    href: "#",
                    label: "API",
                  },
                ]}
              />
              <MarketingFooterColumn
                heading="Community"
                links={[
                  {
                    external: true,
                    href: "#",
                    label: "GitHub",
                  },
                  {
                    external: true,
                    href: "#",
                    label: "Discord",
                  },
                ]}
              />
              <MarketingFooterColumn
                heading="Legal"
                links={[
                  {
                    href: "#",
                    label: "Privacy",
                  },
                  {
                    href: "#",
                    label: "Terms",
                  },
                ]}
              />
            </MarketingFooterGrid>
          </div>
        </Showcase>

        {/* ====================== MARQUEE ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingMarquee</code> is the full-bleed scrolling
              billboard. Stack two/three with <code>MarketingMarqueeStack</code>{" "}
              for the page-break feel.
            </>
          }
          id="marquee"
          title="Marquees"
        >
          <div className="-mx-6 md:-mx-10">
            <MarketingMarqueeStack
              rows={[
                {
                  direction: "left",
                  phrase: "ROUTINE 01 — INSTALL",
                  separator: "●",
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
                  phrase: "AGENTS · TABLES · CELLS",
                  separator: "★",
                  speed: "fast",
                  tone: "dark",
                },
              ]}
            />
          </div>
        </Showcase>

        {/* ====================== SPLASH ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingSplash</code> is the full-bleed visual interlude.
              Compose with <code>SplashContent</code>, <code>SplashTitle</code>,{" "}
              <code>SplashSpec</code>.
            </>
          }
          id="splash"
          title="Splash"
        >
          <div className="-mx-6 overflow-hidden md:-mx-10">
            <MarketingSplash
              height="sm"
              tone="darkest"
              veil="orange"
            >
              <div
                aria-hidden
                className="marketing-grid-bg pointer-events-none absolute inset-0"
              />
              <MarketingSplashContent
                align="center"
                className="gap-3"
              >
                <MarketingSplashSpec>
                  EP-001 · MARBLE · DEMO SPLASH
                </MarketingSplashSpec>
                <MarketingSplashTitle size="md">
                  A spreadsheet that{" "}
                  <span className="text-orange-400">runs code.</span>
                </MarketingSplashTitle>
              </MarketingSplashContent>
            </MarketingSplash>
          </div>
        </Showcase>

        {/* ====================== PANEL ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingPanel</code> is the TE-style faceplate — use
              sparingly for content that benefits from the "instrument" chrome.
              Compose with <code>PanelLabel</code>, <code>PanelDivider</code>,{" "}
              <code>PanelGrille</code>. Marble's UI is warm first, panel-y
              second.
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

        {/* ====================== KEYPAD ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingKeypad</code> + <code>MarketingKey</code> for
              chiclet button grids. Active key gets the orange treatment.{" "}
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

        {/* ====================== LCD ====================== */}
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

        {/* ====================== DIAL ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingDial</code> is a rotary knob with tick marks and a
              pointer. <code>MarketingFader</code> is a vertical slider. Both
              accept <code>sweep</code> / <code>animate</code> for an
              idle-motion loop.
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

        {/* ====================== TICKER ====================== */}
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

        {/* ====================== TILT ====================== */}
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

        {/* ====================== SKYLINE ====================== */}
        <Showcase
          description={
            <>
              <code>MarketingSkyline</code> renders columns-as-towers with
              cells-as-windows. Lit orange = running, lit emerald =
              materialized. Hands-down the Marble visual.
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

        {/* ====================== INSTRUMENT ====================== */}
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

        {/* ====================== SECTION CHROME (recap at the end) ====================== */}
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
      </div>
    </main>
  );
};
export default MarketingShowcasePage;
