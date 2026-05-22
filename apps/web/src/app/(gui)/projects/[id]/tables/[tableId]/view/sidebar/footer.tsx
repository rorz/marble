import { MarbleAlert, MarbleButton } from "@marble/ui";

type SidebarFooterProps = {
  isCreate: boolean;
  onSave: () => void;
  programId: string;
  saving: boolean;
  validationError: string | null;
  name: string;
};

export const SidebarFooter = ({
  isCreate,
  name,
  onSave,
  programId,
  saving,
  validationError,
}: SidebarFooterProps) => (
  <div className="shrink-0 space-y-3 border-t border-taupe-200 bg-taupe-50 px-4 py-2.5">
    {validationError ? (
      <MarbleAlert
        size="sm"
        tone="error"
      >
        {validationError}
      </MarbleAlert>
    ) : null}
    <MarbleButton
      className="w-full"
      disabled={!name.trim() || !programId || saving || !!validationError}
      onClick={onSave}
      variant="orange"
    >
      {saving
        ? isCreate
          ? "Creating..."
          : "Saving..."
        : isCreate
          ? "Create column"
          : "Save Changes"}
    </MarbleButton>
  </div>
);
