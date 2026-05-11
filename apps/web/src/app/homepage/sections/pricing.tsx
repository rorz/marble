import { MarbleButton } from "@marble/ui";
import { CheckIcon, XIcon } from "@phosphor-icons/react/ssr";
import { MarketingCard, MarketingCardEyebrow } from "../ui/card";
import { MarketingPin } from "../ui/mark";
import { Section, SectionHeader, SectionInner } from "../ui/section";
import { MarketingStat, MarketingStatGrid } from "../ui/stat";

export function PricingSection() {
  return (
    <Section
      id="pricing"
      tone="dark"
    >
      <SectionInner
        className="flex flex-col gap-16"
        width="wide"
      >
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
          <SectionHeader
            eyebrow="No credits"
            eyebrowTone="orange"
            heading={
              <>
                Pay for milliseconds,
                <br />
                not seats.
              </>
            }
            lede="Run as much as you want. The cloud offering runs on compute, so you're only charged for the milliseconds your cells actually run."
          />
          <MarketingPin
            className="hidden md:inline-flex md:self-end"
            rotate={6}
            tone="cream"
          >
            free
            <br />
            self-host
          </MarketingPin>
        </div>

        <MarketingCard
          accent="poster"
          className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between md:gap-12"
          tone="cream"
        >
          <div className="flex flex-col gap-3">
            <MarketingCardEyebrow>Hosted plane</MarketingCardEyebrow>
            <div className="flex items-baseline gap-4">
              <span className="font-display font-medium text-7xl leading-none tracking-tight text-taupe-800 md:text-9xl">
                ms
              </span>
              <span className="font-display font-medium text-3xl leading-none tracking-tight text-taupe-700 md:text-5xl">
                = unit
              </span>
            </div>
            <p className="max-w-md text-base text-taupe-700 md:text-lg">
              One number, billed at the unit the platform actually consumes. No
              tiers. No seat ladders. No "starter" / "enterprise" gates.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <MarbleButton variant="orange">See live calculator</MarbleButton>
            <span className="font-mono text-eyebrow text-taupe-500">
              transparent · per-run breakdown
            </span>
          </div>
        </MarketingCard>

        <MarketingStatGrid columns={3}>
          <MarketingStat
            caption="A row added to your team doesn't add a line item. Everyone uses it."
            label="Per seat"
            size="md"
            value={
              <span className="text-taupe-100/60 line-through decoration-orange-400 decoration-[6px]">
                $0
              </span>
            }
          />
          <MarketingStat
            caption="Stockpiling credits you'll never use, or worse — running out mid-flow."
            label="Credits"
            size="md"
            value={
              <span className="text-taupe-100/60 line-through decoration-orange-400 decoration-[6px]">
                Nope
              </span>
            }
          />
          <MarketingStat
            caption="The same minute of compute costs the same on a Tuesday and a Saturday."
            label="Tiers"
            size="md"
            tone="orange"
            value="One"
          />
        </MarketingStatGrid>

        <ComparisonTable />
      </SectionInner>
    </Section>
  );
}

function ComparisonTable() {
  const rows = [
    {
      ms: "Add 1k agents. No invoice change.",
      seats: "Buy a seat per agent. Quarterly true-up.",
      title: "Onboarding the next 1,000 agents",
    },
    {
      ms: "Charged at $0 — the run did $0 of compute.",
      seats: "Charged at $X — the seat is reserved.",
      title: "An idle workspace overnight",
    },
    {
      ms: "Replay is free. Cached cells are free.",
      seats: "Replay counts as new usage, again.",
      title: "Auditing yesterday's runs",
    },
  ] as const;

  return (
    <div className="overflow-hidden rounded-xs border-2 border-taupe-100/15 bg-taupe-800/60">
      <div className="grid grid-cols-1 divide-y-2 divide-taupe-100/15 md:grid-cols-[1.4fr_1fr_1fr] md:divide-x-2 md:divide-y-0">
        <div className="px-6 py-5 font-mono text-eyebrow text-taupe-100/60">
          Scenario
        </div>
        <div className="flex items-center gap-2 px-6 py-5 font-mono text-eyebrow text-taupe-100/60">
          <XIcon
            className="text-taupe-100/40"
            size={14}
          />
          Per-seat
        </div>
        <div className="flex items-center gap-2 bg-orange-500/10 px-6 py-5 font-mono text-eyebrow text-orange-300">
          <CheckIcon size={14} />
          Per-millisecond
        </div>
      </div>
      {rows.map((row) => (
        <div
          className="grid grid-cols-1 divide-y-2 divide-taupe-100/15 border-t-2 border-taupe-100/15 md:grid-cols-[1.4fr_1fr_1fr] md:divide-x-2 md:divide-y-0"
          key={row.title}
        >
          <div className="px-6 py-5 font-display font-medium text-lg text-taupe-100 md:text-xl">
            {row.title}
          </div>
          <div className="px-6 py-5 text-sm text-taupe-100/70 md:text-base">
            {row.seats}
          </div>
          <div className="bg-orange-500/5 px-6 py-5 text-sm text-orange-50 md:text-base">
            {row.ms}
          </div>
        </div>
      ))}
    </div>
  );
}
