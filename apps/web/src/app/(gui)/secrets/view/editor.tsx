"use client";

import {
  cx,
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardFooter,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleField,
  MarbleInput,
} from "@marble/ui";
import { TrashIcon } from "@phosphor-icons/react";
import type { SecretRecord } from "../actions";

export function SecretEditor({
  creating,
  draftName,
  draftValue,
  formError,
  onDelete,
  onNameChange,
  onSave,
  onValueChange,
  pending,
  selectedSecret,
}: {
  creating: boolean;
  draftName: string;
  draftValue: string;
  formError: string | null;
  onDelete: () => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onValueChange: (value: string) => void;
  pending: boolean;
  selectedSecret: SecretRecord | null;
}) {
  return (
    <MarbleCard
      className="min-h-[32rem]"
      tone="subtle"
    >
      <MarbleCardHeader>
        <MarbleCardTitle>
          {creating ? "New secret" : (selectedSecret?.name ?? "Secret details")}
        </MarbleCardTitle>
      </MarbleCardHeader>
      <MarbleCardContent className="gap-4">
        <MarbleAlert tone="neutral">
          Secrets are treated as sensitive values: they are stored securely and
          never shown in the UI.
        </MarbleAlert>

        <MarbleField label="Name">
          <MarbleInput
            disabled={pending}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. OPENAI_API_KEY"
            type="text"
            value={draftName}
            wrapperClassName="w-full"
          />
        </MarbleField>

        <MarbleField label={creating ? "Secret value" : "Replace value"}>
          <MarbleInput
            autoComplete="off"
            disabled={pending}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={
              creating
                ? "Paste the secret value"
                : "Leave blank to keep the current value"
            }
            type="password"
            value={draftValue}
            wrapperClassName="w-full"
          />
        </MarbleField>

        {selectedSecret && !creating ? (
          <MarbleAlert
            size="sm"
            tone="neutral"
          >
            <div className="flex items-center justify-between gap-3">
              <span>Category</span>
              <MarbleBadge
                caps
                tone={
                  selectedSecret.category === "Managed" ? "warning" : "neutral"
                }
              >
                {selectedSecret.category}
              </MarbleBadge>
            </div>
          </MarbleAlert>
        ) : null}

        {formError ? <MarbleAlert tone="error">{formError}</MarbleAlert> : null}
      </MarbleCardContent>
      <MarbleCardFooter>
        <MarbleButton
          disabled={pending || creating || !selectedSecret}
          iconLeft={TrashIcon}
          onClick={onDelete}
          variant="red"
        >
          Delete
        </MarbleButton>

        <MarbleButton
          className={cx("min-w-32")}
          disabled={pending}
          onClick={onSave}
          variant="orange"
        >
          {pending ? "Saving..." : creating ? "Create secret" : "Save"}
        </MarbleButton>
      </MarbleCardFooter>
    </MarbleCard>
  );
}
