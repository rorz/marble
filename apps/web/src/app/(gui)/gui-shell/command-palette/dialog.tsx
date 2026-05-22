import {
  cx,
  MarbleCommandDialog,
  MarbleCommandEmpty,
  MarbleCommandGroup,
  MarbleCommandInput,
  MarbleCommandItem,
  MarbleCommandList,
  MarbleCommandSeparator,
  MarbleSheet,
  MarbleSheetContent,
} from "@marble/ui";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { supportSheetWidthClassName } from "../constants";
import { CommandPaletteSupportSheet } from "../support-sheet";
import type { CommandPaletteSection, SupportSheetView } from "../types";

type CommandPaletteDialogProps = {
  emptyMessage: string;
  footerPrimaryText: string;
  footerSecondaryText: string;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSupportSheetChange: (view: SupportSheetView | null) => void;
  open: boolean;
  query: string;
  sections: CommandPaletteSection[];
  supportSheet: SupportSheetView | null;
};

export const CommandPaletteDialog = ({
  emptyMessage,
  footerPrimaryText,
  footerSecondaryText,
  onKeyDown,
  onOpenChange,
  onQueryChange,
  onSupportSheetChange,
  open,
  query,
  sections,
  supportSheet,
}: CommandPaletteDialogProps) => (
  <>
    <MarbleCommandDialog
      label="Global command palette"
      loop
      onKeyDown={onKeyDown}
      onOpenChange={onOpenChange}
      open={open}
    >
      <MarbleCommandInput
        onValueChange={onQueryChange}
        placeholder="Search projects, programs, profiles, or help..."
        value={query}
      />
      <MarbleCommandList>
        <MarbleCommandEmpty>{emptyMessage}</MarbleCommandEmpty>

        {sections.map((section, sectionIndex) => (
          <div key={section.id}>
            {sectionIndex > 0 ? <MarbleCommandSeparator /> : null}
            <MarbleCommandGroup heading={section.heading}>
              {section.items.map((item) => (
                <MarbleCommandItem
                  key={item.id}
                  keywords={item.keywords}
                  onSelect={item.onSelect}
                  value={item.label}
                >
                  {item.icon}
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="font-mono text-eyebrow-xs text-taupe-400">
                    {item.detail}
                  </span>
                </MarbleCommandItem>
              ))}
            </MarbleCommandGroup>
          </div>
        ))}
      </MarbleCommandList>

      <div className="flex items-center justify-between border-t border-taupe-200 bg-linear-to-t from-taupe-200 via-white to-white px-4 py-2 text-eyebrow text-taupe-500">
        <span>{footerPrimaryText}</span>
        <span>{footerSecondaryText}</span>
      </div>
    </MarbleCommandDialog>

    {supportSheet ? (
      <MarbleSheet
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onSupportSheetChange(null);
          }
        }}
        open
      >
        <MarbleSheetContent
          className={cx(supportSheetWidthClassName, "border-y-0 border-r-0")}
          side="right"
        >
          <CommandPaletteSupportSheet
            onClose={() => onSupportSheetChange(null)}
            view={supportSheet}
          />
        </MarbleSheetContent>
      </MarbleSheet>
    ) : null}
  </>
);
