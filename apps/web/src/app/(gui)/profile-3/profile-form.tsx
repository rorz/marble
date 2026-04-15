"use client";

import {
  MarbleButton,
  MarbleFieldLabel,
  MarbleInput,
  MarbleSelect,
} from "@marble/ui";
import type { RefObject } from "react";
import type { ProfileDraft } from "./model";

export function ProfileForm({
  action,
  defaults,
  disabled = false,
  formRef,
  submitLabel,
  submittingLabel,
  tone = "dark",
}: {
  action: (formData: FormData) => void;
  defaults?: Partial<ProfileDraft>;
  disabled?: boolean;
  formRef?: RefObject<HTMLFormElement | null>;
  submitLabel: string;
  submittingLabel: string;
  tone?: "dark" | "orange";
}) {
  return (
    <form
      action={action}
      className="space-y-4"
      ref={formRef}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_180px]">
        <div className="block">
          <MarbleFieldLabel>Profile name</MarbleFieldLabel>
          <MarbleInput
            defaultValue={defaults?.name ?? ""}
            disabled={disabled}
            name="name"
            placeholder="Customer support agent"
          />
        </div>

        <div className="block">
          <MarbleFieldLabel>External name</MarbleFieldLabel>
          <MarbleInput
            defaultValue={defaults?.externalName ?? ""}
            disabled={disabled}
            name="externalName"
            placeholder="claude-code"
          />
        </div>

        <div className="block">
          <MarbleFieldLabel>Type</MarbleFieldLabel>
          <MarbleSelect
            defaultValue={defaults?.type ?? "Agent"}
            disabled={disabled}
            name="type"
          >
            <option value="Agent">Agent</option>
            <option value="Human">Human</option>
          </MarbleSelect>
        </div>
      </div>

      <div className="flex justify-end">
        <MarbleButton
          disabled={disabled}
          type="submit"
          variant={tone}
        >
          {disabled ? submittingLabel : submitLabel}
        </MarbleButton>
      </div>
    </form>
  );
}
