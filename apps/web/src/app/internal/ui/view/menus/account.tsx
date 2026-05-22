import {
  MarbleAccountMark,
  MarbleAccountPopover,
  MarbleActivityRadar,
  MarbleActivityRadarPanel,
  MarbleActivityRadarTrigger,
  type MarbleContextPopoverSection,
  MarbleProfileAttribution,
} from "@marble/ui";
import { SignOutIcon, UserCircleIcon } from "@phosphor-icons/react/ssr";
import type { Dispatch, SetStateAction } from "react";
import { ReviewNavigatorDemo } from "./review";

const DEMO_AVATAR_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#f97316"/><text x="16" y="22" text-anchor="middle" fill="white" font-family="ui-sans-serif,system-ui,sans-serif" font-size="16" font-weight="700">M</text></svg>',
)}`;

export const AccountPopoverDemo = ({
  handleMenuSelect,
  lastInteraction,
  reviewNavigatorIndex,
  setLastInteraction,
  setReviewNavigatorIndex,
}: Readonly<{
  handleMenuSelect: (label: string) => void;
  lastInteraction: string;
  reviewNavigatorIndex: number;
  setLastInteraction: (label: string) => void;
  setReviewNavigatorIndex: Dispatch<SetStateAction<number>>;
}>) => {
  const accountSections: MarbleContextPopoverSection[] = [
    {
      id: "account-actions",
      items: [
        {
          icon: <UserCircleIcon size={16} />,
          id: "account-settings",
          label: "Account settings",
          onSelect: () => handleMenuSelect("Account settings"),
        },
      ],
    },
    {
      id: "account-session",
      items: [
        {
          icon: <SignOutIcon size={16} />,
          id: "account-sign-out",
          label: "Sign out",
          onSelect: () => handleMenuSelect("Sign out"),
          tone: "danger",
        },
      ],
    },
  ];
  const activityRadarBatches = [
    {
      actors: [
        {
          externalName: "Claude Code",
          icon: "🛠️",
          id: "profile-claude",
          name: "Schema Agent",
          type: "Agent" as const,
        },
      ],
      description: "+1 ~14 · 1 Table · 14 Cells",
      id: "activity-radar-prospects",
      label: "Prospects",
      onSelect: () => handleMenuSelect("Agent changesets: Prospects"),
      segments: [
        {
          tone: "create" as const,
          value: 1,
        },
        {
          tone: "update" as const,
          value: 14,
        },
      ],
      timestampLabel: "Just now",
      unread: true,
    },
    {
      actors: [
        {
          externalName: "Codex",
          icon: "🤖",
          id: "profile-codex",
          name: "Build Agent",
          type: "Agent" as const,
        },
        {
          externalName: "Cursor",
          icon: "🔍",
          id: "profile-cursor",
          name: "Review Agent",
          type: "Agent" as const,
        },
      ],
      description: "~4 -1 · 4 Columns · 1 Row",
      id: "activity-radar-pipeline",
      label: "Pipeline",
      onSelect: () => handleMenuSelect("Agent changesets: Pipeline"),
      segments: [
        {
          tone: "update" as const,
          value: 4,
        },
        {
          tone: "delete" as const,
          value: 1,
        },
      ],
      timestampLabel: "12m ago",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xs border border-taupe-200 bg-white p-4">
        <div className="flex flex-col items-center gap-1.5">
          <MarbleAccountMark displayName="Rory Marshall" />
          <span className="text-eyebrow-xs text-taupe-500">Initials</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <MarbleAccountMark displayName="rory" />
          <span className="text-eyebrow-xs text-taupe-500">Single</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <MarbleAccountMark />
          <span className="text-eyebrow-xs text-taupe-500">Empty</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <MarbleAccountMark
            avatarUrl={DEMO_AVATAR_URL}
            className="size-10"
            displayName="Rory Marshall"
          />
          <span className="text-eyebrow-xs text-taupe-500">Avatar</span>
        </div>
      </div>

      <MarbleAccountPopover
        className="w-full"
        description="rory@marble.dev"
        displayName="Rory Marshall"
        name="Rory Marshall"
        sections={accountSections}
      />

      <MarbleAccountPopover
        avatarUrl={DEMO_AVATAR_URL}
        className="w-full"
        description="rory@marble.dev"
        displayName="Rory Marshall"
        name="Rory Marshall"
        sections={accountSections}
      />

      <div className="flex items-center justify-between rounded-xs border border-taupe-200 bg-white p-3">
        <div className="space-y-1">
          <div className="font-medium text-sm text-taupe-950">
            Compact trigger
          </div>
          <div className="text-sm text-taupe-600">
            Used by the GUI shell when the sidebar collapses to icon rail.
          </div>
        </div>

        <MarbleAccountPopover
          avatarUrl={DEMO_AVATAR_URL}
          compact
          description="rory@marble.dev"
          displayName="Rory Marshall"
          name="Rory Marshall"
          sections={accountSections}
        />
      </div>

      <div className="flex items-center justify-between rounded-xs border border-taupe-200 bg-white p-3">
        <div className="space-y-1">
          <div className="font-medium text-sm text-taupe-950">Slim trigger</div>
          <div className="text-sm text-taupe-600">
            Narrow rail affordance with a dot-sized visual target.
          </div>
        </div>

        <MarbleActivityRadarTrigger
          aria-label="Expand agent sidebar"
          batches={activityRadarBatches}
          slim
          unreadCount={1}
        />
      </div>

      <div className="flex items-center justify-between rounded-xs border border-taupe-200 bg-white p-3">
        <div className="space-y-1">
          <div className="font-medium text-sm text-taupe-950">
            Agent changesets
          </div>
          <div className="text-sm text-taupe-600">
            Compact agentic burst inbox for shell chrome.
          </div>
        </div>

        <MarbleActivityRadar
          batches={activityRadarBatches}
          compact
          onMarkAllRead={() =>
            handleMenuSelect("Agent changesets: Mark all reviewed")
          }
          onOpenFeed={() => handleMenuSelect("Agent changesets: Open events")}
          unreadCount={1}
        />
      </div>

      <div className="rounded-xs border border-taupe-200 bg-white p-3">
        <div className="mb-3 space-y-1">
          <div className="font-medium text-sm text-taupe-950">
            Sidebar panel
          </div>
          <div className="text-sm text-taupe-600">
            Inline review rail for persistent shell-side change monitoring.
          </div>
        </div>

        <div className="h-[28rem]">
          <MarbleActivityRadarPanel
            batches={activityRadarBatches}
            className="h-full"
            onMarkAllRead={() =>
              handleMenuSelect("Agent changesets: Mark all reviewed")
            }
            unreadCount={1}
          />
        </div>
      </div>

      <ReviewNavigatorDemo
        handleMenuSelect={handleMenuSelect}
        reviewNavigatorIndex={reviewNavigatorIndex}
        setLastInteraction={setLastInteraction}
        setReviewNavigatorIndex={setReviewNavigatorIndex}
      />

      <div className="rounded-xs border border-taupe-200 bg-white p-3">
        <div className="mb-3 space-y-1">
          <div className="font-medium text-sm text-taupe-950">
            Profile attribution
          </div>
          <div className="text-sm text-taupe-600">
            Tight ownership marks for one agent or a small mixed group.
          </div>
        </div>

        <div className="space-y-2">
          <MarbleProfileAttribution
            profiles={[
              {
                externalName: "Claude Code",
                icon: "🛠️",
                id: "profile-demo-single",
                name: "Schema Agent",
                type: "Agent",
              },
            ]}
          />
          <MarbleProfileAttribution
            profiles={[
              {
                externalName: "Codex",
                icon: "🤖",
                id: "profile-demo-multi-a",
                name: "Build Agent",
                type: "Agent",
              },
              {
                externalName: "Cursor",
                icon: "🔍",
                id: "profile-demo-multi-b",
                name: "Review Agent",
                type: "Agent",
              },
              {
                externalName: "Human",
                id: "profile-demo-multi-c",
                name: "Rory",
                type: "Human",
              },
            ]}
          />
        </div>
      </div>

      <div className="rounded-xs border border-taupe-200 bg-white px-3 py-2">
        <div className="font-medium text-eyebrow-lg text-taupe-500">
          Last menu action
        </div>
        <div className="mt-1 font-medium text-sm text-taupe-900">
          {lastInteraction}
        </div>
      </div>
    </div>
  );
};
