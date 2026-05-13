import { MarketingCodeBlock } from "../ui/code-block";
import { MarketingPin } from "../ui/mark";
import { Section, SectionHeader, SectionInner } from "../ui/section";
import { MarketingStat, MarketingStatGrid } from "../ui/stat";

export const OpenSourceSection = () => {
  return (
    <Section
      id="open-source"
      tone="darkest"
    >
      <SectionInner
        className="flex flex-col gap-16"
        width="wide"
      >
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
          <SectionHeader
            eyebrow="Open source"
            eyebrowTone="orange"
            heading="Open source. By design."
            lede="Free to use forever. One-click install. Do whatever you want — the only compromise is no support."
          />
          <MarketingPin
            className="hidden md:inline-flex md:self-end"
            rotate={-8}
            tone="orange"
          >
            MIT
            <br />
            licensed
          </MarketingPin>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-[3fr_2fr] md:gap-12">
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

          <div className="flex flex-col justify-center gap-6">
            <p className="text-lg leading-relaxed text-taupe-100/80 md:text-xl">
              No license keys. No "contact us". Clone the repo, run the install,
              and you're operating your own Marble in under a minute.
            </p>
            <MarketingCodeBlock
              size="sm"
              tone="midnight"
            >
              {`# or self-host the entire stack
git clone github.com/marble/marble
bun install && bun run deploy`}
            </MarketingCodeBlock>
          </div>
        </div>

        <MarketingStatGrid columns={3}>
          <MarketingStat
            caption="Every line of the platform, on GitHub, from day one."
            label="License"
            size="md"
            tone="orange"
            value="MIT"
          />
          <MarketingStat
            caption="Run it locally, in your VPC, or on our hosted plane. Same bits, every time."
            label="Self-host"
            size="md"
            tone="cream"
            value="Yours."
          />
          <MarketingStat
            caption="No license keys, no seat counts, no per-vendor billing surprises."
            label="Lock-in"
            size="md"
            value={
              <span className="text-orange-500 line-through decoration-orange-300 decoration-[6px]">
                Zero
              </span>
            }
          />
        </MarketingStatGrid>
      </SectionInner>
    </Section>
  );
};
