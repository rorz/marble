import {
  MarbleAlert,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardFooter,
  MarbleCardHeader,
  MarbleCardSection,
  MarbleCardTitle,
  MarbleCopyField,
  MarbleEmptyState,
  MarbleField,
  MarbleInput,
} from "@marble/ui";
import { FolderOpenIcon, UsersThreeIcon } from "@phosphor-icons/react/ssr";
import { DemoPanel, Section } from "./chrome";

export const SurfacesSection = () => {
  return (
    <Section
      description="Card tones, empty states, and surface framing all live here now so the route reads like a catalog instead of a scratchpad."
      id="surfaces"
      title="Surfaces"
    >
      <div className="space-y-4">
        <DemoPanel
          description="All three card tones with real footer and content treatments."
          title="Cards"
          tone="default"
        >
          <div className="space-y-4">
            <MarbleCard>
              <MarbleCardHeader>
                <MarbleCardTitle>Default</MarbleCardTitle>
                <MarbleCardDescription>
                  Neutral chrome for routine workspace panels.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent>
                <div className="rounded-xs border border-taupe-200 bg-taupe-50 p-3 text-sm text-taupe-600">
                  128 rows synced
                </div>
              </MarbleCardContent>
              <MarbleCardFooter>
                <MarbleButton size="sm">Inspect</MarbleButton>
              </MarbleCardFooter>
            </MarbleCard>

            <MarbleCard>
              <MarbleCardHeader
                actions={[
                  {
                    children: "Create key",
                    size: "sm",
                    variant: "dark",
                  },
                ]}
                disclosureActions={[
                  {
                    label: "Rename profile",
                    onSelect: () => undefined,
                  },
                  {
                    label: "Delete profile",
                    onSelect: () => undefined,
                    tone: "danger",
                  },
                ]}
              >
                <MarbleCardTitle>Action Header</MarbleCardTitle>
                <MarbleCardDescription>
                  Standardized inline buttons and disclosure menus now live in
                  the shared header API.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent>
                <div className="rounded-xs border border-taupe-200 bg-taupe-50 p-3 text-sm text-taupe-600">
                  Use inline actions for primary moves and disclosure items for
                  the destructive or secondary ones.
                </div>
              </MarbleCardContent>
            </MarbleCard>

            <MarbleCard tone="subtle">
              <MarbleCardHeader>
                <MarbleCardTitle>Subtle</MarbleCardTitle>
                <MarbleCardDescription>
                  Low-contrast framing for dense controls.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent className="space-y-2">
                <MarbleField label="Table name">
                  <MarbleInput
                    defaultValue="Prospects"
                    wrapperClassName="w-full"
                  />
                </MarbleField>
              </MarbleCardContent>
            </MarbleCard>

            <MarbleCard>
              <MarbleCardHeader divided>
                <MarbleCardTitle>Divided header</MarbleCardTitle>
                <MarbleCardDescription>
                  Dense data UIs ask the header to separate cleanly from the
                  content below. `divided` is the supported way to do this
                  instead of per-route `border-b` overrides.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent>
                <MarbleAlert
                  size="sm"
                  tone="neutral"
                >
                  The border sits inside the primitive now.
                </MarbleAlert>
              </MarbleCardContent>
            </MarbleCard>

            <MarbleCard>
              <MarbleCardSection className="space-y-1">
                <MarbleCardTitle>Copy fields</MarbleCardTitle>
                <MarbleCardDescription>
                  Clickable value rows for URLs, tokens, and operational
                  identifiers.
                </MarbleCardDescription>
              </MarbleCardSection>
              <MarbleCardSection className="space-y-3">
                <MarbleCopyField
                  label="Webhook endpoint"
                  value="https://api.marble.local/webhooks/source_123"
                />
                <MarbleCopyField
                  label="Webhook token"
                  value="marble_whsec_8f31b4e0"
                />
                <MarbleCopyField
                  copyLabel="Copy cURL"
                  display="block"
                  label="cURL snippet"
                  value={`WEBHOOK_URL="https://api.marble.local/webhooks/source_123"
WEBHOOK_TOKEN="marble_whsec_8f31b4e0"

curl -X POST "$WEBHOOK_URL" \\
  -H "Authorization: Bearer $WEBHOOK_TOKEN" \\
  -H "Content-Type: application/json" \\
  --data '{
  "email": "ada@example.com",
  "name": "Ada Lovelace"
}'`}
                />
              </MarbleCardSection>
            </MarbleCard>

            <MarbleCard tone="orange">
              <MarbleCardHeader>
                <MarbleCardTitle>Orange</MarbleCardTitle>
                <MarbleCardDescription>
                  Accent treatment for active or promoted surfaces.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent>
                <div className="rounded-xs border border-orange-200 bg-white/80 p-3 text-sm text-taupe-700">
                  14 runnable columns ready
                </div>
              </MarbleCardContent>
              <MarbleCardFooter>
                <MarbleButton
                  size="sm"
                  variant="orange"
                >
                  Run all
                </MarbleButton>
              </MarbleCardFooter>
            </MarbleCard>

            <MarbleCard
              className="min-h-[20rem]"
              tone="subtle"
            >
              <MarbleCardHeader>
                <MarbleCardTitle>Snap-to-bottom footer</MarbleCardTitle>
                <MarbleCardDescription>
                  When a card has spare vertical space, the footer snaps to the
                  bottom, draws a top border, and right-aligns its actions by
                  default. No per-route className gymnastics required.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent>
                <div className="rounded-xs border border-taupe-200 bg-white/70 p-3 text-sm text-taupe-600">
                  Short content, tall card — primitives own the layout.
                </div>
              </MarbleCardContent>
              <MarbleCardFooter>
                <MarbleButton variant="red">Delete</MarbleButton>
                <MarbleButton variant="dark">Save</MarbleButton>
              </MarbleCardFooter>
            </MarbleCard>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Minimal and action-led empty states. iconTone normalizes the bordered icon tile."
          title="Empty states"
        >
          <div className="space-y-4">
            <MarbleCard>
              <MarbleCardContent>
                <MarbleEmptyState
                  description="iconTone='orange' wraps the icon in the standard tile."
                  icon={<FolderOpenIcon size={20} />}
                  iconTone="orange"
                  title="No projects yet"
                />
              </MarbleCardContent>
            </MarbleCard>

            <MarbleCard tone="subtle">
              <MarbleCardContent>
                <MarbleEmptyState
                  actions={
                    <MarbleButton
                      size="sm"
                      variant="orange"
                    >
                      Create profile
                    </MarbleButton>
                  }
                  description="iconTone='neutral' for a quieter affordance."
                  icon={<UsersThreeIcon size={20} />}
                  iconTone="neutral"
                  title="No profiles yet"
                />
              </MarbleCardContent>
            </MarbleCard>
          </div>
        </DemoPanel>
      </div>
    </Section>
  );
};
