import {
  MarbleBrandMark,
  MarbleButton,
  MarbleContextPopover,
  type MarbleContextPopoverSection,
  MarbleMenuButton,
} from "@marble/ui";
import {
  DatabaseIcon,
  GearSixIcon,
  QuestionIcon,
  SignOutIcon,
} from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { DemoPanel, Section } from "../chrome";
import { AccountPopoverDemo } from "./account";

export const MenusSection = () => {
  const [lastInteraction, setLastInteraction] = useState("Waiting for input");
  const [reviewNavigatorIndex, setReviewNavigatorIndex] = useState(1);

  const handleMenuSelect = (label: string) => {
    setLastInteraction(label);
  };

  const utilitySections: MarbleContextPopoverSection[] = [
    {
      id: "utility-primary",
      items: [
        {
          icon: <GearSixIcon size={16} />,
          id: "utility-settings",
          label: "Settings",
          onSelect: () => handleMenuSelect("Settings"),
        },
        {
          description: "Disabled items stay in the list for discoverability.",
          disabled: true,
          icon: <DatabaseIcon size={16} />,
          id: "utility-billing",
          label: "Billing",
          onSelect: () => handleMenuSelect("Billing"),
        },
      ],
    },
    {
      id: "utility-secondary",
      items: [
        {
          detail: "Docs",
          icon: <QuestionIcon size={16} />,
          id: "utility-help",
          label: "Help",
          onSelect: () => handleMenuSelect("Help"),
        },
        {
          icon: <SignOutIcon size={16} />,
          id: "utility-sign-out",
          label: "Sign out",
          onSelect: () => handleMenuSelect("Sign out"),
          tone: "danger",
        },
      ],
    },
  ];

  return (
    <Section
      description="Popover coverage now includes default and custom triggers, sectioned menus, workspace marks, compact workspace switchers, and disabled items."
      id="menus"
      title="Menus"
    >
      <div className="space-y-4">
        <DemoPanel
          description="Default dot trigger plus a custom button trigger with header content."
          title="Context popovers"
        >
          <div className="space-y-4">
            <div className="rounded-xs border border-taupe-200 bg-white p-4">
              <div className="mb-3 font-medium text-eyebrow-lg text-taupe-500">
                Menu button
              </div>
              <MarbleMenuButton
                ariaLabel="Open export menu"
                items={[
                  {
                    description: "Download the current table as CSV.",
                    id: "export-csv",
                    label: "CSV",
                    onSelect: () => handleMenuSelect("Export CSV"),
                  },
                ]}
                label="Export"
                size="sm"
              />
            </div>

            <div className="rounded-xs border border-taupe-200 bg-white p-4">
              <div className="mb-3 font-medium text-eyebrow-lg text-taupe-500">
                Default trigger
              </div>
              <MarbleContextPopover
                ariaLabel="Open utility menu"
                sections={utilitySections}
              />
            </div>

            <div className="rounded-xs border border-taupe-200 bg-white p-4">
              <div className="mb-3 font-medium text-eyebrow-lg text-taupe-500">
                Custom trigger
              </div>
              <MarbleContextPopover
                align="start"
                ariaLabel="Open project menu"
                asChild
                header={
                  <div className="rounded-xs border border-orange-200 bg-orange-50/80 px-3 py-2">
                    <div className="font-medium text-sm text-taupe-950">
                      Project actions
                    </div>
                    <div className="text-xs text-taupe-600">
                      Header content keeps context attached to the menu.
                    </div>
                  </div>
                }
                sections={utilitySections}
              >
                <MarbleButton size="sm">Quick actions</MarbleButton>
              </MarbleContextPopover>
            </div>

            <div className="rounded-xs border border-taupe-200 bg-white p-4">
              <div className="mb-3 font-medium text-eyebrow-lg text-taupe-500">
                Free-form content
              </div>
              <MarbleContextPopover
                align="end"
                ariaLabel="Open invite panel"
                asChild
                content={
                  <div className="w-72 space-y-3">
                    <div className="font-medium text-sm text-taupe-950">
                      Invite a teammate
                    </div>
                    <p className="text-xs text-taupe-600">
                      Use the `content` slot when the popover hosts a form or
                      other arbitrary controls instead of a menu of items.
                      Click-outside, escape, and positioning still come from the
                      primitive.
                    </p>
                    <div className="flex justify-end">
                      <MarbleButton size="sm">Send invite</MarbleButton>
                    </div>
                  </div>
                }
              >
                <MarbleButton size="sm">Invite</MarbleButton>
              </MarbleContextPopover>
            </div>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Decorative Marble glyph for brand chrome. Not tied to identity or workspace data."
          title="Brand mark"
        >
          <div className="flex items-end gap-4 rounded-xs border border-taupe-200 bg-white p-4">
            <div className="flex flex-col items-center gap-1.5">
              <MarbleBrandMark />
              <span className="text-eyebrow-xs text-taupe-500">Default</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <MarbleBrandMark className="size-10" />
              <span className="text-eyebrow-xs text-taupe-500">Larger</span>
            </div>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Identity mark with initials fallback, avatar URL state, full trigger, and compact trigger."
          title="Account popover"
        >
          <AccountPopoverDemo
            handleMenuSelect={handleMenuSelect}
            lastInteraction={lastInteraction}
            reviewNavigatorIndex={reviewNavigatorIndex}
            setLastInteraction={setLastInteraction}
            setReviewNavigatorIndex={setReviewNavigatorIndex}
          />
        </DemoPanel>
      </div>
    </Section>
  );
};
