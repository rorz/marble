import {
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleCommandDialog,
  MarbleCommandEmpty,
  MarbleCommandGroup,
  MarbleCommandInput,
  MarbleCommandItem,
  MarbleCommandList,
  MarbleCommandMenu,
  MarbleCommandSeparator,
} from "@marble/ui";
import {
  DatabaseIcon,
  FolderOpenIcon,
  QuestionIcon,
  SignOutIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { DemoPanel, Section } from "./chrome";

export const CommandsSection = () => {
  const [isCommandDialogOpen, setIsCommandDialogOpen] = useState(false);
  const [selectedCommandExample, setSelectedCommandExample] =
    useState("Open projects");

  const handleCommandSelect = (
    label: string,
    options?: {
      closeDialog?: boolean;
    },
  ) => {
    setSelectedCommandExample(label);

    if (options?.closeDialog) {
      setIsCommandDialogOpen(false);
    }
  };

  const renderCommandMenu = (closeDialog = false) => (
    <>
      <MarbleCommandInput placeholder="Search projects, docs, or support..." />
      <MarbleCommandList>
        <MarbleCommandEmpty>No matching command.</MarbleCommandEmpty>

        <MarbleCommandGroup heading="Workspace">
          <MarbleCommandItem
            keywords={[
              "projects",
              "folders",
            ]}
            onSelect={() =>
              handleCommandSelect("Open projects", {
                closeDialog,
              })
            }
            value="Open projects"
          >
            <FolderOpenIcon
              className="text-orange-600"
              size={16}
            />
            <span className="flex-1">Open projects</span>
          </MarbleCommandItem>
          <MarbleCommandItem
            keywords={[
              "profiles",
              "people",
            ]}
            onSelect={() =>
              handleCommandSelect("Browse profiles", {
                closeDialog,
              })
            }
            value="Browse profiles"
          >
            <UsersThreeIcon
              className="text-emerald-600"
              size={16}
            />
            <span className="flex-1">Browse profiles</span>
          </MarbleCommandItem>
          <MarbleCommandItem
            disabled
            keywords={[
              "billing",
              "plan",
            ]}
            value="Billing"
          >
            <DatabaseIcon size={16} />
            <span className="flex-1">Billing</span>
          </MarbleCommandItem>
        </MarbleCommandGroup>

        <MarbleCommandSeparator />

        <MarbleCommandGroup heading="Support">
          <MarbleCommandItem
            keywords={[
              "help",
              "docs",
            ]}
            onSelect={() =>
              handleCommandSelect("Open help examples", {
                closeDialog,
              })
            }
            value="Open help examples"
          >
            <QuestionIcon
              className="text-violet-600"
              size={16}
            />
            <span className="flex-1">Open help examples</span>
          </MarbleCommandItem>
          <MarbleCommandItem
            keywords={[
              "logout",
              "exit",
            ]}
            onSelect={() =>
              handleCommandSelect("Sign out", {
                closeDialog,
              })
            }
            value="Sign out"
          >
            <SignOutIcon
              className="text-rose-600"
              size={16}
            />
            <span className="flex-1">Sign out</span>
          </MarbleCommandItem>
        </MarbleCommandGroup>
      </MarbleCommandList>
    </>
  );

  return (
    <>
      <Section
        description="The command surface now covers inline and dialog usage, disabled items, empty states, and selection feedback."
        id="commands"
        title="Commands"
      >
        <div className="space-y-4">
          <DemoPanel
            description="Inline command menu with grouped items and keyword search. The standalone surface keeps its border + radius."
            title="Command menu"
          >
            <div className="h-[25rem]">
              <MarbleCommandMenu
                className="h-full"
                label="UI catalog command menu demo"
                loop
              >
                {renderCommandMenu()}
              </MarbleCommandMenu>
            </div>
          </DemoPanel>

          <DemoPanel
            description="Embedded mode drops the left/right borders + radius for command surfaces that sit flush inside a host card."
            title="Command menu (embedded)"
          >
            <MarbleCard className="overflow-hidden">
              <MarbleCardHeader>
                <MarbleCardTitle>Workspace actions</MarbleCardTitle>
                <MarbleCardDescription>
                  Embedded surfaces are bracketed by top + bottom borders so the
                  host card owns the radius.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent className="px-0 pb-0">
                <div className="h-[20rem]">
                  <MarbleCommandMenu
                    className="h-full"
                    embedded
                    label="Embedded command menu demo"
                    loop
                  >
                    {renderCommandMenu()}
                  </MarbleCommandMenu>
                </div>
              </MarbleCardContent>
            </MarbleCard>
          </DemoPanel>

          <DemoPanel
            description="Dialog-backed command surface using the same items."
            title="Command dialog"
          >
            <div className="space-y-4">
              <MarbleBadge
                caps
                tone="info"
              >
                cmdk
              </MarbleBadge>
              <p className="text-sm text-taupe-600">
                Search for `people`, `docs`, or `logout` to hit the keyword
                paths and empty-state behavior.
              </p>
              <MarbleButton
                onClick={() => setIsCommandDialogOpen(true)}
                size="sm"
                variant="dark"
              >
                Open dialog example
              </MarbleButton>
              <div className="rounded-xs border border-taupe-200 bg-white px-3 py-2">
                <div className="font-medium text-eyebrow-lg text-taupe-500">
                  Last command selection
                </div>
                <div className="mt-1 font-medium text-sm text-taupe-900">
                  {selectedCommandExample}
                </div>
              </div>
            </div>
          </DemoPanel>
        </div>
      </Section>

      <MarbleCommandDialog
        label="UI catalog command dialog demo"
        loop
        onOpenChange={setIsCommandDialogOpen}
        open={isCommandDialogOpen}
      >
        {renderCommandMenu(true)}
      </MarbleCommandDialog>
    </>
  );
};
