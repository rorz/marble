import {
  MarketingDiagram,
  MarketingDiagramArrow,
  MarketingDiagramNode,
} from "../../../homepage/ui/diagram";
import {
  MarketingFooterColumn,
  MarketingFooterGrid,
} from "../../../homepage/ui/footer-grid";
import {
  MarketingLogoMark,
  MarketingLogoStrip,
} from "../../../homepage/ui/logo-strip";
import { BRAND_REGISTRY, type BrandId } from "../../../homepage/ui/logos";
import {
  MarketingMarqueeStack,
  MarketingSplash,
  MarketingSplashContent,
  MarketingSplashSpec,
  MarketingSplashTitle,
} from "../../../homepage/ui/splash";
import { Demo, Showcase } from "./chrome";

export const SystemShowcases = () => {
  return (
    <>
      <Showcase
        description={
          <>
            <code>MarketingLogoStrip</code> + <code>MarketingLogoMark</code> for
            "works with" / "powered by" attribution. Brand glyphs from the
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

      <Showcase
        description={
          <>
            <code>MarketingMarquee</code> is the full-bleed scrolling billboard.
            Stack two/three with <code>MarketingMarqueeStack</code> for the
            page-break feel.
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
                phrase: "bunx marble-cli init",
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
    </>
  );
};
