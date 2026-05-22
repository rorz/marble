import {
  MarbleBadge,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleListRow,
  MarbleSpinner,
  MarbleTabs,
  MarbleTabsContent,
  MarbleTabsList,
  MarbleTabsTrigger,
} from "@marble/ui";
import { CodeIcon, TerminalIcon } from "@phosphor-icons/react/ssr";
import { DemoPanel, Section } from "../chrome";
import { PaneDemo } from "./pane";
import { MarbleRouterDemo, RouteProgressDemo } from "./route-progress";
import { WorkbenchDemo } from "./workbench";

export const NavigationSection = () => {
  return (
    <Section
      description="Rows and panes now show the primary size, tone, width, and action combinations instead of only one demo path."
      id="navigation"
      title="Navigation"
    >
      <div className="space-y-4">
        <DemoPanel
          description="Composable route tabs with active, hover, and focus underline motion plus count badges on triggers."
          title="Tabs"
        >
          <MarbleTabs defaultValue="mine">
            <MarbleTabsList>
              <MarbleTabsTrigger
                badge={2}
                value="mine"
              >
                My programs
              </MarbleTabsTrigger>
              <MarbleTabsTrigger
                badge={8}
                value="system"
              >
                System programs
              </MarbleTabsTrigger>
              <MarbleTabsTrigger value="marketplace">
                Program marketplace
              </MarbleTabsTrigger>
            </MarbleTabsList>
            <MarbleTabsContent value="mine">
              <div className="min-h-28 rounded-sm bg-taupe-50 p-4 text-sm text-taupe-700">
                <p className="font-medium text-zinc-950">My programs</p>
                <p className="mt-1">
                  User-created cards mount below the shared tab bar.
                </p>
              </div>
            </MarbleTabsContent>
            <MarbleTabsContent value="system">
              <div className="min-h-28 rounded-sm bg-taupe-50 p-4 text-sm text-taupe-700">
                <p className="font-medium text-zinc-950">System programs</p>
                <p className="mt-1">
                  Read-only templates can expose their own fork action.
                </p>
              </div>
            </MarbleTabsContent>
            <MarbleTabsContent value="marketplace">
              <div className="min-h-28 rounded-sm bg-taupe-50 p-4 text-sm text-taupe-700">
                <p className="font-medium text-zinc-950">Marketplace</p>
                <p className="mt-1">
                  Placeholder surfaces use the same navigation shell.
                </p>
              </div>
            </MarbleTabsContent>
          </MarbleTabs>
        </DemoPanel>

        <DemoPanel
          description="Compact, small, active, orange, and aside variants — plus the iconTone shortcut that wraps icons in the standard bordered tile."
          title="List rows"
        >
          <MarbleCard>
            <MarbleCardContent className="p-0">
              <MarbleListRow
                description="Compact layout for list-heavy surfaces, with iconTone='orange'."
                icon={<CodeIcon size={16} />}
                iconTone="orange"
                meta={
                  <span className="font-mono text-[11px] text-zinc-500">
                    v8
                  </span>
                }
                size="compact"
                title="Audience enrichment"
                tone="orange"
              />
              <MarbleListRow
                description="iconTone='neutral' normalizes the bordered tile so secrets, profiles, and sources share the same icon container."
                icon={<TerminalIcon size={16} />}
                iconTone="neutral"
                size="compact"
                title="OPENAI_API_KEY"
              />
              <MarbleListRow
                active
                aside={<MarbleBadge tone="info">Selected</MarbleBadge>}
                description="Small active row with inline aside (raw icon, no tone)."
                icon={
                  <CodeIcon
                    className="text-sky-600"
                    size={16}
                  />
                }
                size="sm"
                title="runner.ts"
              />
              <MarbleListRow
                align="start"
                description="Default density with start alignment and disabled treatment."
                disabled
                icon={
                  <TerminalIcon
                    className="text-zinc-500"
                    size={16}
                  />
                }
                title="Archived command"
              />
            </MarbleCardContent>
          </MarbleCard>
        </DemoPanel>

        <DemoPanel
          description="Full-width, narrow, and flush pane layouts with shared chrome."
          title="Pane"
        >
          <PaneDemo />
        </DemoPanel>

        <DemoPanel
          description="Dense editor surfaces can now reuse collapsible workbench sections, resize handles, and closeable tab strips instead of improvising bespoke chrome."
          title="Workbench"
        >
          <WorkbenchDemo />
        </DemoPanel>

        <DemoPanel
          description="Top-anchored 2px progress bar that surfaces pending route transitions. For client-side anchor navigation, use MarbleLink — a drop-in for next/link that auto-publishes via MarbleRouteProgressBeacon. For programmatic nav, use useMarbleRouter() — it wraps router.push/replace/refresh/back/forward in startTransition and reports automatically. Manual escape hatch: useReportRouteProgress(isPending) around your own transition."
          title="Route progress"
        >
          <RouteProgressDemo />
          <MarbleRouterDemo />
        </DemoPanel>

        <DemoPanel
          description="Indeterminate progress affordance for inline pending states (button-loading, row-fetching, panel skeleton). Four sizes — xs (10px), sm (12px), md (16px), lg (24px) — and four tones inheriting from currentColor."
          title="Spinner"
        >
          <div className="flex flex-wrap items-center gap-6 rounded-xs border border-taupe-200 bg-white/60 p-4">
            <div className="flex items-center gap-3">
              <MarbleSpinner size="xs" />
              <MarbleSpinner size="sm" />
              <MarbleSpinner size="md" />
              <MarbleSpinner size="lg" />
            </div>
            <div className="flex items-center gap-3">
              <MarbleSpinner tone="neutral" />
              <MarbleSpinner tone="orange" />
              <MarbleSpinner tone="subtle" />
            </div>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Pass href to render a MarbleCard as a MarbleLink — auto-publishes to the route-progress bar and picks up hover/cursor/focus-visible affordances. Use interactive on click-only cards to get the same affordances without the link wrapper."
          title="Interactive card"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MarbleCard href="/internal/ui#cards">
              <MarbleCardHeader>
                <MarbleCardTitle>Hoverable link card</MarbleCardTitle>
                <MarbleCardDescription>
                  Renders as <code>&lt;Link&gt;</code>. Hover for affordance,
                  click to publish a pending route to the top bar.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent>
                <p className="text-sm text-taupe-600">
                  The entire surface is clickable. Cursor, hover border, and
                  focus ring all come from the primitive.
                </p>
              </MarbleCardContent>
            </MarbleCard>

            <MarbleCard
              interactive
              role="button"
              tabIndex={0}
              tone="orange"
            >
              <MarbleCardHeader>
                <MarbleCardTitle>Interactive click card</MarbleCardTitle>
                <MarbleCardDescription>
                  Hover/focus affordances without the Link wrapper, for onClick
                  handlers and command-style cards.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent>
                <p className="text-sm text-taupe-600">
                  Pair with useMarbleRouter().push() to publish progress.
                </p>
              </MarbleCardContent>
            </MarbleCard>
          </div>
        </DemoPanel>
      </div>
    </Section>
  );
};
