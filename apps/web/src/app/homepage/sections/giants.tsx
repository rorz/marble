import {
  BroadcastIcon,
  CloudIcon,
  DatabaseIcon,
  LightningIcon,
} from "@phosphor-icons/react/ssr";
import {
  MarketingCard,
  MarketingCardBody,
  MarketingCardContent,
  MarketingCardEyebrow,
  MarketingCardGlyph,
  MarketingCardPill,
  MarketingCardTitle,
} from "../ui/card";
import {
  MarketingDiagram,
  MarketingDiagramArrow,
  MarketingDiagramNode,
} from "../ui/diagram";
import { Section, SectionHeader, SectionInner } from "../ui/section";

export function GiantsSection() {
  return (
    <Section
      id="giants"
      tone="mid"
    >
      <SectionInner
        className="flex flex-col gap-16"
        width="wide"
      >
        <SectionHeader
          eyebrow="On the shoulders of giants"
          heading={
            <>
              Supabase for realtime.
              <br />
              Cloudflare for orchestration.
            </>
          }
          lede="We didn't reinvent the substrate. Marble runs on two of the best primitives on the open web — Supabase for live, durable state, and Cloudflare for fan-out execution at the edge."
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <MarketingCard
            accent="poster"
            className="flex flex-col gap-6"
            tone="cream"
          >
            <div className="flex items-start gap-4">
              <MarketingCardGlyph>
                <BroadcastIcon size={24} />
              </MarketingCardGlyph>
              <MarketingCardContent>
                <MarketingCardEyebrow>Stateful plane</MarketingCardEyebrow>
                <MarketingCardTitle size="lg">Supabase</MarketingCardTitle>
                <MarketingCardBody>
                  Postgres + Realtime is the live wire. Every cell, row, and run
                  is durably stored and instantly streamed to every open client.
                </MarketingCardBody>
              </MarketingCardContent>
            </div>

            <ul className="flex flex-col gap-2 text-base text-taupe-700 md:text-lg">
              <li className="flex items-baseline gap-3">
                <DatabaseIcon
                  className="text-orange-500"
                  size={18}
                />
                Durable row-level Postgres
              </li>
              <li className="flex items-baseline gap-3">
                <BroadcastIcon
                  className="text-orange-500"
                  size={18}
                />
                Realtime fan-out via `postgres_changes`
              </li>
              <li className="flex items-baseline gap-3">
                <CloudIcon
                  className="text-orange-500"
                  size={18}
                />
                Auth, storage, and RLS out of the box
              </li>
            </ul>

            <div className="flex flex-wrap gap-2">
              <MarketingCardPill>Postgres</MarketingCardPill>
              <MarketingCardPill tone="neutral">Realtime</MarketingCardPill>
              <MarketingCardPill tone="neutral">Auth</MarketingCardPill>
            </div>
          </MarketingCard>

          <MarketingCard
            className="flex flex-col gap-6"
            tone="dark"
          >
            <div className="flex items-start gap-4">
              <MarketingCardGlyph>
                <LightningIcon size={24} />
              </MarketingCardGlyph>
              <MarketingCardContent>
                <MarketingCardEyebrow>Execution plane</MarketingCardEyebrow>
                <MarketingCardTitle size="lg">Cloudflare</MarketingCardTitle>
                <MarketingCardBody>
                  Workers, Durable Objects, Workflows. The program graph fans
                  out at the edge — runs are cheap, replays are instant,
                  isolation is free.
                </MarketingCardBody>
              </MarketingCardContent>
            </div>

            <ul className="flex flex-col gap-2 text-base text-taupe-100/80 md:text-lg">
              <li className="flex items-baseline gap-3">
                <LightningIcon
                  className="text-orange-400"
                  size={18}
                />
                Edge Workers, isolate-per-call
              </li>
              <li className="flex items-baseline gap-3">
                <CloudIcon
                  className="text-orange-400"
                  size={18}
                />
                Durable Objects for run state
              </li>
              <li className="flex items-baseline gap-3">
                <BroadcastIcon
                  className="text-orange-400"
                  size={18}
                />
                Workflows for long-running orchestration
              </li>
            </ul>

            <div className="flex flex-wrap gap-2">
              <MarketingCardPill>Workers</MarketingCardPill>
              <MarketingCardPill tone="neutral">DOs</MarketingCardPill>
              <MarketingCardPill tone="neutral">Workflows</MarketingCardPill>
            </div>
          </MarketingCard>
        </div>

        <MarketingDiagram className="text-taupe-100">
          <MarketingDiagramNode
            body="Your workspace lives in Supabase."
            eyebrow="State"
            label="Supabase"
            tone="orange"
          />
          <MarketingDiagramArrow
            direction="right"
            label="postgres_changes"
          />
          <MarketingDiagramNode
            body="The runtime that materializes cells."
            eyebrow="Compute"
            label="Marble Executor"
            tone="dark"
          />
          <MarketingDiagramArrow
            direction="right"
            label="rpc"
          />
          <MarketingDiagramNode
            body="Edge isolates run your programs."
            eyebrow="Edge"
            label="Cloudflare"
            tone="orange"
          />
        </MarketingDiagram>
      </SectionInner>
    </Section>
  );
}
