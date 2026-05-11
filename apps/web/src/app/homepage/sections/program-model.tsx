import { cx } from "@marble/ui";
import { ShareNetworkIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { MarketingCardGrid, MarketingPoster } from "../ui/card";
import { MarketingCodeBlock, MarketingCodeMark } from "../ui/code-block";
import {
  MarketingDiagram,
  MarketingDiagramArrow,
  MarketingDiagramNode,
} from "../ui/diagram";
import { Section, SectionHeader, SectionInner } from "../ui/section";
import { MarketingTile } from "../ui/tile";

export function ProgramModelSection() {
  return (
    <Section
      id="program-model"
      tone="darkest"
    >
      <SectionInner
        className="flex flex-col gap-16"
        width="wide"
      >
        <SectionHeader
          eyebrow="Program model"
          eyebrowTone="orange"
          heading={
            <>
              Every column is a program.
              <br />
              Every program is{" "}
              <span className="text-orange-400">shareable</span>.
            </>
          }
          lede="Marble's primitive is the column. Each one is a small, deterministic program that reads other cells and writes its own. Compose them, ship them, share them."
        />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
          <MarketingPoster caption="leads.marble — Cells generated live by the highlighted column">
            <FakeTable />
          </MarketingPoster>

          <MarketingCodeBlock
            size="md"
            title="programs / lead_score.ts"
            tone="midnight"
          >
            {`import { program } from "@marble/core";

export default program({
  inputs: { company: "string", revenue: "number" },
  output: "number",
  run: async ({ inputs, ai }) => {
    const research = await ai.web(
      \`market footprint of \${inputs.company}\`,
    );
    return await ai.score({
      research,
      revenue: inputs.revenue,
    });
  },
});`}
          </MarketingCodeBlock>
        </div>

        <MarketingDiagram className="text-taupe-100">
          <MarketingDiagramNode
            body="The container — a typed surface with rows of records."
            eyebrow="01"
            label="Table"
            tone="dark"
          />
          <MarketingDiagramArrow direction="right" />
          <MarketingDiagramNode
            body="A single column is a program — pure, reproducible, testable."
            eyebrow="02"
            label="Column"
            tone="orange"
          />
          <MarketingDiagramArrow direction="right" />
          <MarketingDiagramNode
            body="Cells materialize when a column runs against a row. Cached, observable."
            eyebrow="03"
            label="Cell"
            tone="dark"
          />
          <MarketingDiagramArrow direction="right" />
          <MarketingDiagramNode
            body="Publish, import, fork. Programs are first-class artefacts."
            eyebrow="04"
            glyph={<ShareNetworkIcon size={22} />}
            label="Shared"
            tone="dark"
          />
        </MarketingDiagram>

        <MarketingCardGrid columns={3}>
          <MarketingTile
            body="Programs are deterministic functions over typed inputs. Same row → same cell. Bring a row back, replay the program."
            eyebrow="Pure"
            title="Reproducible by construction"
            tone="dark"
          />
          <MarketingTile
            body="Programs compose. A column reads other cells, and the whole graph re-runs when upstream cells change."
            eyebrow="Composable"
            title="A spreadsheet that runs code"
            tone="dark"
          />
          <MarketingTile
            body={
              <>
                <MarketingCodeMark>marble push lead_score</MarketingCodeMark>{" "}
                publishes the program to your library. Anyone can install it and
                wire it into their own tables.
              </>
            }
            eyebrow="Shareable"
            title="Programs travel like packages"
            tone="dark"
          />
        </MarketingCardGrid>
      </SectionInner>
    </Section>
  );
}

/**
 * Loose CSS-only fake of Marble's table — purely decorative. The third
 * column is highlighted to map to the adjacent program snippet.
 */
function FakeTable() {
  const rows = [
    [
      "Acme",
      "$3.2M",
      "running",
    ],
    [
      "Brava",
      "$1.1M",
      "running",
    ],
    [
      "Coral",
      "$8.4M",
      "running",
    ],
    [
      "Dune",
      "$0.4M",
      "queued",
    ],
    [
      "Eko",
      "$5.7M",
      "running",
    ],
  ];

  return (
    <div className="font-mono text-sm text-taupe-700">
      <div className="grid grid-cols-[1.4fr_1fr_1.3fr] divide-x-2 divide-taupe-700/70 border-b-2 border-taupe-700/70 bg-taupe-200">
        <Cell heading>company</Cell>
        <Cell heading>revenue</Cell>
        <Cell
          accent
          heading
        >
          lead_score
        </Cell>
      </div>
      {rows.map((row) => (
        <div
          className="grid grid-cols-[1.4fr_1fr_1.3fr] divide-x-2 divide-taupe-700/30 border-b-2 border-taupe-700/30 last:border-b-0"
          key={row[0]}
        >
          <Cell>{row[0]}</Cell>
          <Cell>{row[1]}</Cell>
          <Cell accent>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-orange-500" />
              {row[2]}
            </span>
          </Cell>
        </div>
      ))}
    </div>
  );
}

function Cell({
  children,
  heading,
  accent,
}: {
  children: ReactNode;
  heading?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cx(
        "px-4 py-3",
        heading
          ? "font-semibold text-eyebrow text-taupe-800"
          : "text-taupe-700",
        accent && "bg-orange-100",
      )}
    >
      {children}
    </div>
  );
}
