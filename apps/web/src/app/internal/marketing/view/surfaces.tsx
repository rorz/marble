import { GithubLogoIcon } from "@phosphor-icons/react/ssr";
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
} from "../../../homepage/ui/card";
import { MarketingCodeBlock } from "../../../homepage/ui/code-block";
import { MarketingStat, MarketingStatGrid } from "../../../homepage/ui/stat";
import { MarketingTile } from "../../../homepage/ui/tile";
import { Demo, Showcase } from "./chrome";

export const SurfaceShowcases = () => {
  return (
    <>
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
            {`bunx marble-cli init my-workspace
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
    </>
  );
};
