import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  marbleToast,
} from "@marble/ui";
import {
  ArrowRightIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react/ssr";
import { DemoPanel, Section } from "./chrome";

const badgeTones = [
  "neutral",
  "warning",
  "info",
  "error",
  "solid",
  "success",
] as const;

const alertTones = [
  "neutral",
  "info",
  "success",
  "warning",
  "error",
] as const;

const buttonVariants = [
  {
    children: "Add Row",
    label: "Default",
    variant: "light",
  },
  {
    children: "Inspect",
    label: "Dark",
    variant: "dark",
  },
  {
    children: "Run All",
    label: "Orange",
    variant: "orange",
  },
  {
    children: "Delete",
    label: "Red",
    variant: "red",
  },
] as const;

export const ActionsSection = () => {
  return (
    <Section
      description="Buttons, badges, and alerts now show every tone, the shipped size transitions, and the standard icon slots instead of only the happy path."
      id="actions"
      title="Actions"
    >
      <div className="space-y-4">
        <DemoPanel
          description="Every button variant in all shipped sizes, plus disabled states and standardized phosphor icon slots."
          title="Buttons"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="font-medium text-eyebrow-lg text-taupe-500">
                Medium
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {buttonVariants.map((button) => (
                  <MarbleButton
                    key={`md-${button.label}`}
                    variant={button.variant}
                  >
                    {button.children}
                  </MarbleButton>
                ))}
                <MarbleButton
                  disabled
                  variant="orange"
                >
                  Running…
                </MarbleButton>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-eyebrow-lg text-taupe-500">
                Small
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {buttonVariants.map((button) => (
                  <MarbleButton
                    key={`sm-${button.label}`}
                    size="sm"
                    variant={button.variant}
                  >
                    {button.children}
                  </MarbleButton>
                ))}
                <MarbleButton
                  disabled
                  size="sm"
                  variant="dark"
                >
                  Disabled
                </MarbleButton>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-eyebrow-lg text-taupe-500">
                Extra Small
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {buttonVariants.map((button) => (
                  <MarbleButton
                    key={`xs-${button.label}`}
                    size="xs"
                    variant={button.variant}
                  >
                    {button.children}
                  </MarbleButton>
                ))}
                <MarbleButton
                  disabled
                  size="xs"
                  variant="dark"
                >
                  Disabled
                </MarbleButton>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-eyebrow-lg text-taupe-500">
                With icons
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <MarbleButton iconLeft={PlusIcon}>Add Row</MarbleButton>
                <MarbleButton
                  iconRight={ArrowRightIcon}
                  variant="dark"
                >
                  Inspect
                </MarbleButton>
                <MarbleButton
                  iconLeft={PlayIcon}
                  variant="orange"
                >
                  Run All
                </MarbleButton>
                <MarbleButton
                  iconLeft={TrashIcon}
                  variant="red"
                >
                  Delete
                </MarbleButton>
              </div>
            </div>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Shared toast chrome for editor lifecycle nudges and background sync feedback. The `MarbleToaster` provider is mounted once at the app root layout; `marbleToast(...)` and its `.success() / .error() / .message()` variants are the call sites consumers use throughout the app."
          title="Toasts"
        >
          <div className="flex flex-wrap gap-3">
            <MarbleButton
              onClick={() =>
                marbleToast("Draft created", {
                  description:
                    "Forked from v12. Existing columns still use v12.",
                })
              }
              size="sm"
            >
              Show neutral toast
            </MarbleButton>
            <MarbleButton
              onClick={() =>
                marbleToast.success("Published v13", {
                  description:
                    "Existing columns stay pinned until you update them.",
                })
              }
              size="sm"
              variant="orange"
            >
              Show success toast
            </MarbleButton>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Status tones with both badge casing modes and alert sizes."
          title="Badges and alerts"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {badgeTones.map((tone) => (
                <MarbleBadge
                  caps
                  key={`caps-${tone}`}
                  tone={tone}
                >
                  {tone}
                </MarbleBadge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {badgeTones.map((tone) => (
                <MarbleBadge
                  key={`plain-${tone}`}
                  tone={tone}
                >
                  {tone}
                </MarbleBadge>
              ))}
            </div>
            <div className="grid gap-2">
              {alertTones.map((tone) => (
                <div
                  className="grid gap-2 lg:grid-cols-[1fr_auto]"
                  key={tone}
                >
                  <MarbleAlert tone={tone}>
                    {tone} feedback for dense workspace UI.
                  </MarbleAlert>
                  <MarbleAlert
                    size="sm"
                    tone={tone}
                  >
                    {tone}
                  </MarbleAlert>
                </div>
              ))}
            </div>
          </div>
        </DemoPanel>
      </div>
    </Section>
  );
};
