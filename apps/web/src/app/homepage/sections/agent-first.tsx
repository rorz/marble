import {
  GraphIcon,
  LightbulbIcon,
  PuzzlePieceIcon,
  TableIcon,
  TerminalIcon,
} from "@phosphor-icons/react/ssr";
import { MarketingAnnotation } from "../ui/annotation";
import { MarketingCardGrid } from "../ui/card";
import { MarketingKey, MarketingKeypad } from "../ui/keypad";
import {
  MarketingPanel,
  MarketingPanelDivider,
  MarketingPanelLabel,
} from "../ui/panel";
import { Section, SectionHeader, SectionInner } from "../ui/section";
import { MarketingTile } from "../ui/tile";

const AGENTS: Array<{
  glyph: string;
  index: string;
  caption: string;
  active?: boolean;
}> = [
  {
    caption: "claude",
    glyph: "C",
    index: "A1",
  },
  {
    caption: "codex",
    glyph: "X",
    index: "A2",
  },
  {
    active: true,
    caption: "cursor",
    glyph: "/",
    index: "A3",
  },
  {
    caption: "continue",
    glyph: "→",
    index: "A4",
  },
  {
    caption: "opencode",
    glyph: "{}",
    index: "A5",
  },
  {
    caption: "aider",
    glyph: "+",
    index: "A6",
  },
  {
    caption: "windsurf",
    glyph: "≈",
    index: "A7",
  },
  {
    caption: "your own",
    glyph: "★",
    index: "A8",
  },
];

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

        {/* Agent keypad — the K.O. II move applied to agent compatibility. */}
        <MarketingPanel
          brand="WORKS WITH"
          model="MCP · OPEN PROTOCOL"
          spec="KIT-AGENTS / 08 SLOTS"
          tone="dark"
        >
          <MarketingPanelLabel
            className="mb-3"
            index="01"
          >
            COMPATIBLE AGENTS
          </MarketingPanelLabel>
          <MarketingKeypad
            columns={8}
            gap="md"
          >
            {AGENTS.map((agent) => (
              <MarketingKey
                active={agent.active}
                caption={agent.caption}
                glyph={agent.glyph}
                index={agent.index}
                key={agent.index}
                led
                size="md"
                tone="midnight"
              />
            ))}
          </MarketingKeypad>
          <MarketingPanelDivider
            className="mt-6 mb-4"
            label="02 / PROTOCOL"
          />
          <div className="flex flex-wrap items-center gap-3 font-mono text-eyebrow-xs">
            <span className="rounded-full border-2 border-orange-500/60 px-3 py-1 text-orange-300">
              MCP
            </span>
            <span className="rounded-full border-2 border-taupe-100/20 px-3 py-1 text-taupe-100/70">
              REST
            </span>
            <span className="rounded-full border-2 border-taupe-100/20 px-3 py-1 text-taupe-100/70">
              CLI
            </span>
            <span className="rounded-full border-2 border-taupe-100/20 px-3 py-1 text-taupe-100/70">
              REALTIME
            </span>
            <span className="ml-2 text-taupe-100/50">
              … and anything that speaks MCP.
            </span>
          </div>
        </MarketingPanel>

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
