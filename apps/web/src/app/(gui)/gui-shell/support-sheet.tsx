import {
  MarbleBadge,
  MarbleButton,
  MarbleSheetDescription,
  MarbleSheetFooter,
  MarbleSheetHeader,
  MarbleSheetTitle,
} from "@marble/ui";

import { SupportPanelSection } from "./support-section";
import type { SupportSheetView } from "./types";

export const CommandPaletteSupportSheet = ({
  onClose,
  view,
}: Readonly<{
  onClose: () => void;
  view: SupportSheetView;
}>) => {
  if (view === "contact") {
    return (
      <>
        <MarbleSheetHeader>
          <MarbleSheetTitle>Contact Us</MarbleSheetTitle>
          <MarbleSheetDescription>
            Placeholder support surface while the real contact flow is still
            being wired up.
          </MarbleSheetDescription>
        </MarbleSheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <MarbleBadge
            caps
            tone="warning"
          >
            Placeholder
          </MarbleBadge>

          <SupportPanelSection title="What this will become">
            <p>
              This slot is reserved for direct support routing, escalation
              instructions, and whatever contact mechanism we settle on next.
            </p>
          </SupportPanelSection>

          <SupportPanelSection title="For now">
            <p>
              Use the Marble Handbook for product navigation and keep this item
              around as the obvious support-shaped follow-up in the menu.
            </p>
          </SupportPanelSection>
        </div>

        <MarbleSheetFooter>
          <MarbleButton onClick={onClose}>Close</MarbleButton>
        </MarbleSheetFooter>
      </>
    );
  }

  return (
    <>
      <MarbleSheetHeader>
        <MarbleSheetTitle>Marble Handbook</MarbleSheetTitle>
        <MarbleSheetDescription>
          A command-menu-native guide for the core Marble surfaces.
        </MarbleSheetDescription>
      </MarbleSheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <MarbleBadge
          caps
          tone="info"
        >
          Inside cmdk
        </MarbleBadge>

        <SupportPanelSection title="Jump anywhere">
          <p>
            Open the palette with Cmd/Ctrl+K, then search for projects, tables,
            sources, pipes, programs, profiles, automations, or events to move
            without touching the sidebar.
          </p>
        </SupportPanelSection>

        <SupportPanelSection title="Search behavior">
          <p>
            Command items already carry keywords, so typing terms like `help`,
            `docs`, `rows`, `people`, or resource names is enough to surface the
            right target.
          </p>
        </SupportPanelSection>

        <SupportPanelSection title="Support entry points">
          <p>
            Search `help` to reopen this handbook. The adjacent contact entry is
            intentionally a placeholder until the real support path lands.
          </p>
        </SupportPanelSection>
      </div>

      <MarbleSheetFooter>
        <MarbleButton onClick={onClose}>Close</MarbleButton>
      </MarbleSheetFooter>
    </>
  );
};
