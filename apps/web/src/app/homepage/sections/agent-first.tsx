import {
  GraphIcon,
  LightbulbIcon,
  PuzzlePieceIcon,
  RobotIcon,
  TableIcon,
  TerminalIcon,
} from "@phosphor-icons/react/ssr";
import { MarketingAnnotation } from "../ui/annotation";
import { MarketingCardGrid } from "../ui/card";
import { MarketingLogoMark, MarketingLogoStrip } from "../ui/logo-strip";
import { Section, SectionHeader, SectionInner } from "../ui/section";
import { MarketingTile } from "../ui/tile";

export function AgentFirstSection() {
  return (
    <Section
      id="agent-first"
      tone="mid"
    >
      <SectionInner
        className="flex flex-col gap-16"
        width="wide"
      >
        <div className="relative">
          <SectionHeader
            eyebrow="Agent first"
            heading={
              <>
                Built for the
                <br />
                agentic future.
              </>
            }
            lede="Works with any agent via Skills and Plugins. Single-command setup. A tabular interface for every kind of agentic workflow."
          />
          <MarketingAnnotation
            className="absolute -top-8 right-0 hidden md:block"
            rotate={6}
            size="sm"
            tone="orange"
          >
            agent-shaped
          </MarketingAnnotation>
        </div>

        <MarketingLogoStrip label="Works with">
          <MarketingLogoMark
            glyph={<RobotIcon size={20} />}
            name="Claude"
            tone="midnight"
          />
          <MarketingLogoMark
            glyph={<RobotIcon size={20} />}
            name="Codex"
            tone="midnight"
          />
          <MarketingLogoMark
            glyph={<RobotIcon size={20} />}
            name="Cursor"
            tone="midnight"
          />
          <MarketingLogoMark
            glyph={<RobotIcon size={20} />}
            name="Continue"
            tone="midnight"
          />
          <MarketingLogoMark
            glyph={<RobotIcon size={20} />}
            name="OpenCode"
            tone="midnight"
          />
          <MarketingLogoMark
            caption="& anything that"
            glyph={<TerminalIcon size={20} />}
            name="speaks MCP"
            tone="midnight"
          />
        </MarketingLogoStrip>

        <MarketingCardGrid columns={4}>
          <MarketingTile
            body="Drop in a skill folder and any compatible agent picks up Marble's surface, semantics, and live state."
            glyph={<LightbulbIcon size={22} />}
            index="01"
            title="Skills"
            tone="dark"
          />
          <MarketingTile
            body="Extend any column or table with a packaged plugin. Versioned, reviewable, and operator-installable."
            glyph={<PuzzlePieceIcon size={22} />}
            index="02"
            title="Plugins"
            tone="dark"
          />
          <MarketingTile
            body="The interface humans already trust to think in rows, columns, and cells — handed to your agents."
            glyph={<TableIcon size={22} />}
            index="03"
            title="Tabular interface"
            tone="dark"
          />
          <MarketingTile
            body="One CLI install. One workspace boot. Your agent is on the inside in under a minute."
            glyph={<TerminalIcon size={22} />}
            index="04"
            title="Single-command setup"
            tone="dark"
          />
        </MarketingCardGrid>

        <MarketingTile
          body="Every Marble resource speaks Marble — programs, tables, rows, cells, runs. Agents don't simulate the product, they operate inside it."
          emphasize
          eyebrow="Why it matters"
          glyph={<GraphIcon size={26} />}
          title={
            <>
              A surface agents <em className="text-orange-300">actually</em>{" "}
              understand.
            </>
          }
          tone="midnight"
        />
      </SectionInner>
    </Section>
  );
}
