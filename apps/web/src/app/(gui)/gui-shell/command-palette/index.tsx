import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useState,
} from "react";
import type { SidebarTreeData } from "../../../../lib/sidebar-tree";
import { isEditableKeyboardTarget } from "../../keyboard-capture";
import type {
  CommandPalettePage,
  CommandPaletteSection,
  SupportSheetView,
} from "../types";
import { useCommandPaletteActions } from "./actions";
import { buildCreateProjectSections } from "./create-sections";
import { CommandPaletteDialog } from "./dialog";
import { buildResourceCommandPaletteSections } from "./resource-sections";
import {
  buildRootCommandPaletteSections,
  buildSupportCommandSection,
} from "./root-sections";

type GuiCommandPaletteParams = {
  pathname: string;
  sidebarData: SidebarTreeData;
};

const createResourceLabelByPage = {
  "create-pipe-project": "pipe",
  "create-source-project": "source",
  "create-table-project": "table",
} satisfies Record<CommandPalettePage, string>;

const isSupportSearchQuery = (query: string) =>
  [
    "contact",
    "docs",
    "handbook",
    "help",
    "support",
  ].some((term) => query.includes(term));

type CommandPaletteShortcutsParams = {
  isCommandPaletteOpen: boolean;
  setCommandPaletteQuery: (query: string) => void;
  setCommandPaletteSupportSheet: (view: SupportSheetView | null) => void;
  setIsCommandPaletteOpen: (open: boolean) => void;
};

const useCommandPaletteShortcuts = ({
  isCommandPaletteOpen,
  setCommandPaletteQuery,
  setCommandPaletteSupportSheet,
  setIsCommandPaletteOpen,
}: CommandPaletteShortcutsParams) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const normalizedKey =
        typeof event.key === "string" ? event.key.toLowerCase() : "";

      if (
        event.defaultPrevented ||
        normalizedKey !== "k" ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        event.repeat
      ) {
        return;
      }

      if (
        !isCommandPaletteOpen &&
        isEditableKeyboardTarget(event.target, {
          ignoreCommandMenu: true,
        })
      ) {
        return;
      }

      event.preventDefault();

      if (isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
        setCommandPaletteQuery("");
        setCommandPaletteSupportSheet(null);
        return;
      }

      setCommandPaletteQuery("");
      setCommandPaletteSupportSheet(null);
      setIsCommandPaletteOpen(true);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isCommandPaletteOpen,
    setCommandPaletteQuery,
    setCommandPaletteSupportSheet,
    setIsCommandPaletteOpen,
  ]);
};

type SupportSheetShortcutsParams = {
  commandPaletteSupportSheet: SupportSheetView | null;
  setCommandPaletteSupportSheet: (view: SupportSheetView | null) => void;
};

const useSupportSheetShortcuts = ({
  commandPaletteSupportSheet,
  setCommandPaletteSupportSheet,
}: SupportSheetShortcutsParams) => {
  useEffect(() => {
    if (commandPaletteSupportSheet === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setCommandPaletteSupportSheet(null);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    commandPaletteSupportSheet,
    setCommandPaletteSupportSheet,
  ]);
};

export const useGuiCommandPalette = ({
  pathname,
  sidebarData,
}: GuiCommandPaletteParams) => {
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [commandPalettePages, setCommandPalettePages] = useState<
    CommandPalettePage[]
  >([]);
  const [commandPaletteSupportSheet, setCommandPaletteSupportSheet] =
    useState<SupportSheetView | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const currentCommandPalettePage = commandPalettePages.at(-1) ?? null;
  const resetCommandPalette = () => {
    setCommandPaletteQuery("");
    setCommandPalettePages([]);
    setCommandPaletteSupportSheet(null);
  };
  const handleCommandPaletteOpenChange = (nextOpen: boolean) => {
    setIsCommandPaletteOpen(nextOpen);

    if (!nextOpen) {
      resetCommandPalette();
    }
  };
  const openCommandPalette = (query = "") => {
    setCommandPaletteQuery(query);
    setCommandPaletteSupportSheet(null);
    setIsCommandPaletteOpen(true);
  };
  const openHelpCommandPalette = () => {
    openCommandPalette("help");
  };
  const closeCommandPalette = () => {
    handleCommandPaletteOpenChange(false);
  };
  const pushCommandPalettePage = (page: CommandPalettePage) => {
    setCommandPalettePages((current) => [
      ...current,
      page,
    ]);
    setCommandPaletteQuery("");
  };
  const popCommandPalettePage = () => {
    setCommandPalettePages((current) => current.slice(0, -1));
    setCommandPaletteQuery("");
  };
  const openSupportSheet = (view: SupportSheetView) => {
    closeCommandPalette();
    setCommandPaletteSupportSheet(view);
  };
  const actions = useCommandPaletteActions({
    closeCommandPalette,
    pathname,
    pushCommandPalettePage,
    sidebarData,
  });
  const supportCommandSection = buildSupportCommandSection({
    onOpenSupportSheet: openSupportSheet,
  });
  const rootCommandPaletteSections = buildRootCommandPaletteSections({
    actions,
    onOpenSupportSheet: openSupportSheet,
  });
  const resourceCommandPaletteSections = buildResourceCommandPaletteSections({
    actions,
    sidebarData,
  });
  const createProjectSectionsByPage = buildCreateProjectSections(actions);
  const normalizedCommandPaletteQuery = commandPaletteQuery.toLowerCase();
  const isSupportQuery =
    currentCommandPalettePage === null &&
    isSupportSearchQuery(normalizedCommandPaletteQuery);
  const commandPaletteSections: CommandPaletteSection[] = (
    currentCommandPalettePage !== null
      ? createProjectSectionsByPage[currentCommandPalettePage]
      : isSupportQuery
        ? [
            supportCommandSection,
            ...rootCommandPaletteSections,
            ...resourceCommandPaletteSections,
          ]
        : [
            ...rootCommandPaletteSections,
            ...resourceCommandPaletteSections,
            supportCommandSection,
          ]
  ).filter((section) => section.items.length > 0);
  const commandPaletteEmptyMessage =
    currentCommandPalettePage !== null
      ? `No matching project for a new ${
          createResourceLabelByPage[currentCommandPalettePage]
        }.`
      : "No matching command. Try `projects`, `rows`, `people`, or `help`.";
  const commandPaletteFooterPrimaryText =
    currentCommandPalettePage !== null
      ? "Enter creates in the selected project"
      : "Enter opens the selected item";
  const commandPaletteFooterSecondaryText =
    commandPaletteSupportSheet !== null
      ? "Esc closes the side panel first"
      : currentCommandPalettePage !== null
        ? "Esc or Backspace returns to actions"
        : "Cmd/Ctrl+K toggles this menu";
  const handleCommandPaletteKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      currentCommandPalettePage === null ||
      !(
        event.key === "Escape" ||
        (event.key === "Backspace" && commandPaletteQuery.length === 0)
      )
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    popCommandPalettePage();
  };

  useCommandPaletteShortcuts({
    isCommandPaletteOpen,
    setCommandPaletteQuery,
    setCommandPaletteSupportSheet,
    setIsCommandPaletteOpen,
  });
  useSupportSheetShortcuts({
    commandPaletteSupportSheet,
    setCommandPaletteSupportSheet,
  });

  return {
    commandPaletteNode: (
      <CommandPaletteDialog
        emptyMessage={commandPaletteEmptyMessage}
        footerPrimaryText={commandPaletteFooterPrimaryText}
        footerSecondaryText={commandPaletteFooterSecondaryText}
        onKeyDown={handleCommandPaletteKeyDown}
        onOpenChange={handleCommandPaletteOpenChange}
        onQueryChange={setCommandPaletteQuery}
        onSupportSheetChange={setCommandPaletteSupportSheet}
        open={isCommandPaletteOpen}
        query={commandPaletteQuery}
        sections={commandPaletteSections}
        supportSheet={commandPaletteSupportSheet}
      />
    ),
    isCommandPaletteActive:
      isCommandPaletteOpen || commandPaletteSupportSheet !== null,
    openHelpCommandPalette,
  };
};
