import { KeyIcon, SparkleIcon } from "@phosphor-icons/react/ssr";
import {
  MarketingCard,
  MarketingCardBody,
  MarketingCardContent,
  MarketingCardEyebrow,
  MarketingCardGlyph,
  MarketingCardPill,
  MarketingCardTitle,
} from "../ui/card";
import { MarketingLogoMark, MarketingLogoStrip } from "../ui/logo-strip";
import { BRAND_REGISTRY, type BrandId } from "../ui/logos";
import { Section, SectionHeader, SectionInner } from "../ui/section";

const PROVIDER_BRANDS: BrandId[] = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "groq",
  "openrouter",
  "ollama",
];

export const ByokSection = () => {
  return (
    <Section
      id="byok"
      tone="mid"
    >
      <SectionInner
        className="flex flex-col gap-14"
        width="wide"
      >
        <SectionHeader
          eyebrow="Bring your own keys"
          heading={
            <>
              Use your model providers,
              <br />
              or use ours.
            </>
          }
          lede="Drop your OpenAI / Anthropic / Google / Mistral keys into the workspace, and they're routed straight through. No proxy. No middleman. Or skip the setup — our hosted plane comes pre-wired."
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <MarketingCard
            accent="poster"
            className="flex flex-col gap-6"
            tone="cream"
          >
            <MarketingCardEyebrow>Option A</MarketingCardEyebrow>
            <div className="flex items-start gap-4">
              <MarketingCardGlyph>
                <KeyIcon size={24} />
              </MarketingCardGlyph>
              <MarketingCardContent>
                <MarketingCardTitle size="lg">
                  Bring your own.
                </MarketingCardTitle>
                <MarketingCardBody>
                  Paste a key into the workspace. Marble routes every call
                  straight to the upstream provider. We never see the payload,
                  the prompt, or the response.
                </MarketingCardBody>
              </MarketingCardContent>
            </div>

            <MarketingLogoStrip label="Drop-in providers">
              {PROVIDER_BRANDS.map((id) => {
                const entry = BRAND_REGISTRY[id];
                const Glyph = entry.Glyph;
                return (
                  <MarketingLogoMark
                    glyph={
                      <Glyph
                        // Provider strip lives on a `cream`/`light` tile
                        // — switch to a darker tone so the glyph reads.
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

            <div className="flex flex-wrap gap-2">
              <MarketingCardPill>Pass-through</MarketingCardPill>
              <MarketingCardPill tone="neutral">Zero log</MarketingCardPill>
              <MarketingCardPill tone="neutral">
                Pay providers direct
              </MarketingCardPill>
            </div>
          </MarketingCard>

          <MarketingCard
            className="flex flex-col gap-6"
            tone="dark"
          >
            <MarketingCardEyebrow>Option B</MarketingCardEyebrow>
            <div className="flex items-start gap-4">
              <MarketingCardGlyph>
                <SparkleIcon size={24} />
              </MarketingCardGlyph>
              <MarketingCardContent>
                <MarketingCardTitle size="lg">
                  Or use ours — no setup.
                </MarketingCardTitle>
                <MarketingCardBody>
                  Sign up and start running programs. Our managed plane comes
                  with the same providers pre-wired, billed straight to the
                  milliseconds your cells actually run.
                </MarketingCardBody>
              </MarketingCardContent>
            </div>

            <ul className="flex flex-col gap-2 text-base text-taupe-100/80 md:text-lg">
              <li className="flex items-baseline gap-3">
                <span className="font-mono text-eyebrow text-orange-300">
                  →
                </span>
                Same providers, same models, sane defaults.
              </li>
              <li className="flex items-baseline gap-3">
                <span className="font-mono text-eyebrow text-orange-300">
                  →
                </span>
                Granular logging and replay across every run.
              </li>
              <li className="flex items-baseline gap-3">
                <span className="font-mono text-eyebrow text-orange-300">
                  →
                </span>
                Drop in your own keys later — no migration penalty.
              </li>
            </ul>

            <div className="flex flex-wrap gap-2">
              <MarketingCardPill>Hosted</MarketingCardPill>
              <MarketingCardPill tone="neutral">
                Per-ms billing
              </MarketingCardPill>
              <MarketingCardPill tone="neutral">Auto-routing</MarketingCardPill>
            </div>
          </MarketingCard>
        </div>
      </SectionInner>
    </Section>
  );
};
