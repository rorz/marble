import {
  MarbleCard,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarblePane,
  marbleToast,
} from "@marble/ui";

export const PaneDemo = () => {
  return (
    <div className="space-y-4">
      <div className="h-80 overflow-hidden rounded-sm border border-taupe-200 bg-taupe-50 shadow-sm">
        <MarblePane
          actions={[
            {
              children: "Create",
              id: "pane-create",
              variant: "orange",
            },
            {
              children: "Inspect",
              id: "pane-inspect",
              variant: "dark",
            },
          ]}
          crumbs={[
            {
              href: "/projects",
              id: "pane-projects",
              label: "Projects",
            },
            {
              id: "pane-current",
              label: "Untitled Project",
            },
          ]}
          disclosureActions={[
            {
              label: "Delete project",
              onSelect: () => marbleToast.message("Delete project"),
              tone: "danger",
            },
          ]}
        >
          <MarbleCard>
            <MarbleCardHeader>
              <MarbleCardTitle>Full width</MarbleCardTitle>
              <MarbleCardDescription>
                Breadcrumbs, actions, and scroll framing stay in the shared
                primitive.
              </MarbleCardDescription>
            </MarbleCardHeader>
          </MarbleCard>
        </MarblePane>
      </div>

      <div className="h-80 overflow-hidden rounded-sm border border-taupe-200 bg-white shadow-sm">
        <MarblePane
          actions={[
            {
              children: "Inspect",
              id: "pane-flush-inspect",
              variant: "dark",
            },
          ]}
          crumbs={[
            {
              href: "/tables",
              id: "pane-tables",
              label: "Tables",
            },
            {
              id: "pane-flush-current",
              label: "Pipeline Runs",
            },
          ]}
          frame="none"
        >
          <MarbleCard className="rounded-none border-x-0 shadow-none">
            <MarbleCardHeader>
              <MarbleCardTitle>Flush frame</MarbleCardTitle>
              <MarbleCardDescription>
                Remove the pane inset when the content should sit directly
                against the surrounding shell while the breadcrumb rail keeps
                its normal chrome.
              </MarbleCardDescription>
            </MarbleCardHeader>
          </MarbleCard>
        </MarblePane>
      </div>

      <div className="h-80 overflow-hidden rounded-sm border border-taupe-200 bg-white shadow-sm">
        <MarblePane
          description="A narrower reading column for setup and detail pages. Narrow panes also get extra top padding so the heading has room to breathe."
          title="Narrow pane"
          width="Narrow"
        >
          <MarbleCard tone="subtle">
            <MarbleCardHeader>
              <MarbleCardTitle>Focused content</MarbleCardTitle>
              <MarbleCardDescription>
                The narrow width keeps long-form setup content more legible.
              </MarbleCardDescription>
            </MarbleCardHeader>
          </MarbleCard>
        </MarblePane>
      </div>

      <div className="h-80 overflow-hidden rounded-sm border border-taupe-200 bg-white shadow-sm">
        <MarblePane
          description="Dashboard widths for pages that arrange two columns of cards or wider lists."
          title="Wide pane"
          width="Wide"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <MarbleCard>
              <MarbleCardHeader>
                <MarbleCardTitle>Left column</MarbleCardTitle>
                <MarbleCardDescription>
                  Two cards sit side-by-side without bumping into the edge.
                </MarbleCardDescription>
              </MarbleCardHeader>
            </MarbleCard>
            <MarbleCard tone="subtle">
              <MarbleCardHeader>
                <MarbleCardTitle>Right column</MarbleCardTitle>
                <MarbleCardDescription>
                  Same width budget either side.
                </MarbleCardDescription>
              </MarbleCardHeader>
            </MarbleCard>
          </div>
        </MarblePane>
      </div>

      <div className="h-80 overflow-hidden rounded-sm border border-taupe-200 bg-white shadow-sm">
        <MarblePane
          description="Roomy width for list-heavy admin views (Secrets, audit logs) that still want a comfortable max width."
          title="Extra-wide pane"
          width="ExtraWide"
        >
          <MarbleCard>
            <MarbleCardHeader>
              <MarbleCardTitle>Long-list surface</MarbleCardTitle>
              <MarbleCardDescription>
                Uses max-w-6xl so rows of bindings or audit entries have
                horizontal room without going edge-to-edge.
              </MarbleCardDescription>
            </MarbleCardHeader>
          </MarbleCard>
        </MarblePane>
      </div>
    </div>
  );
};
