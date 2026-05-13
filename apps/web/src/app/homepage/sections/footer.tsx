import { MarketingFooterColumn, MarketingFooterGrid } from "../ui/footer-grid";
import { MarketingDotRow, MarketingStackedWordmark } from "../ui/mark";
import { Section, SectionInner } from "../ui/section";

export const FooterSection = () => {
  return (
    <Section
      padding="md"
      tone="darkest"
    >
      <SectionInner
        className="flex flex-col gap-16"
        width="wide"
      >
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-6">
            <MarketingStackedWordmark size="md">
              Marble
            </MarketingStackedWordmark>
            <p className="max-w-md text-lg text-taupe-100/70 md:text-xl">
              Fast, reliable, and open GTM tooling — built by and for operators
              and engineers.
            </p>
            <MarketingDotRow count={5} />
          </div>

          <MarketingFooterGrid className="md:max-w-2xl">
            <MarketingFooterColumn
              heading="Product"
              links={[
                {
                  href: "#program-model",
                  label: "Program model",
                },
                {
                  href: "#agent-first",
                  label: "Agent first",
                },
                {
                  href: "#byok",
                  label: "BYOK",
                },
                {
                  href: "#pricing",
                  label: "Pricing",
                },
              ]}
            />
            <MarketingFooterColumn
              heading="Resources"
              links={[
                {
                  href: "/docs",
                  label: "Documentation",
                },
                {
                  href: "/docs/skills",
                  label: "Skills",
                },
                {
                  href: "/docs/plugins",
                  label: "Plugins",
                },
                {
                  href: "/changelog",
                  label: "Changelog",
                },
              ]}
            />
            <MarketingFooterColumn
              heading="Community"
              links={[
                {
                  external: true,
                  href: "https://github.com/anomalyco/marble",
                  label: "GitHub",
                },
                {
                  external: true,
                  href: "https://discord.gg/marble",
                  label: "Discord",
                },
                {
                  external: true,
                  href: "https://x.com/marble",
                  label: "X / Twitter",
                },
              ]}
            />
            <MarketingFooterColumn
              heading="Legal"
              links={[
                {
                  href: "/privacy",
                  label: "Privacy",
                },
                {
                  href: "/terms",
                  label: "Terms",
                },
                {
                  href: "/security",
                  label: "Security",
                },
              ]}
            />
          </MarketingFooterGrid>
        </div>

        <div className="flex flex-col gap-4 border-t-2 border-taupe-100/10 pt-8 md:flex-row md:items-center md:justify-between">
          <span className="font-mono text-eyebrow text-taupe-100/40">
            © {new Date().getFullYear()} Marble — MIT licensed.
          </span>
          <span className="font-mono text-eyebrow text-taupe-100/40">
            Built in the open · v0.0.1
          </span>
        </div>
      </SectionInner>
    </Section>
  );
};
