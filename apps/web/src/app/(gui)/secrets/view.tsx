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
  MarbleConfirmModal,
  type MarbleConfirmModalState,
  MarbleEmptyState,
  MarbleField,
  MarbleInput,
  MarbleListRow,
  marbleToast,
} from "@marble/ui";
import { KeyIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useMarbleWebSessionSdk } from "../../../lib/marble-sdk-client";
import type { SecretRecord } from "./actions";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

function sortSecrets(secrets: SecretRecord[]) {
  return [
    ...secrets,
  ].sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function SecretsPageView({
  initialSecrets,
}: {
  initialSecrets: SecretRecord[];
}) {
  const sdk = useMarbleWebSessionSdk();
  const [secrets, setSecrets] = useState(() => sortSecrets(initialSecrets));
  const [selectedSecretId, setSelectedSecretId] = useState<string | null>(
    initialSecrets[0]?.id ?? null,
  );
  const [creating, setCreating] = useState(initialSecrets.length === 0);
  const [draftName, setDraftName] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmState, setConfirmState] =
    useState<MarbleConfirmModalState | null>(null);

  useEffect(() => {
    setSecrets(sortSecrets(initialSecrets));
  }, [
    initialSecrets,
  ]);

  const selectedSecret = selectedSecretId
    ? (secrets.find((secret) => secret.id === selectedSecretId) ?? null)
    : null;

  useEffect(() => {
    if (creating) {
      setDraftName("");
      setDraftValue("");
      setFormError(null);
      return;
    }

    if (!selectedSecret) {
      setDraftName("");
      setDraftValue("");
      setFormError(null);
      return;
    }

    setDraftName(selectedSecret.name);
    setDraftValue("");
    setFormError(null);
  }, [
    creating,
    selectedSecret,
  ]);

  const handleStartCreate = () => {
    setCreating(true);
    setSelectedSecretId(null);
  };

  const handleSave = async () => {
    const trimmedName = draftName.trim();

    if (!trimmedName) {
      setFormError("Secret names must not be empty.");
      return;
    }

    if (creating && draftValue.trim().length === 0) {
      setFormError("Provide a secret value before saving.");
      return;
    }

    setPending(true);
    setFormError(null);

    try {
      if (creating) {
        const created = await sdk.secrets.create({
          name: trimmedName,
          value: draftValue,
        });

        setSecrets((current) =>
          sortSecrets([
            created,
            ...current,
          ]),
        );
        setCreating(false);
        setSelectedSecretId(created.id);
        marbleToast.success("Secret saved");
        return;
      }

      if (!selectedSecret) {
        throw new Error("Select a secret before saving.");
      }

      const nextValue = draftValue.trim();
      const hasNameChange = trimmedName !== selectedSecret.name;
      const hasValueChange = nextValue.length > 0;

      if (!hasNameChange && !hasValueChange) {
        setFormError("Nothing changed.");
        return;
      }

      const updated = await sdk.secrets.update({
        id: selectedSecret.id,
        values: {
          ...(hasNameChange
            ? {
                name: trimmedName,
              }
            : {}),
          ...(hasValueChange
            ? {
                value: draftValue,
              }
            : {}),
        },
      });

      setSecrets((current) =>
        sortSecrets(
          current.map((secret) =>
            secret.id === updated.id ? updated : secret,
          ),
        ),
      );
      setDraftValue("");
      marbleToast.success("Secret updated");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };

  const handleDelete = () => {
    if (!selectedSecret || pending) {
      return;
    }

    setConfirmState({
      confirmLabel: "Delete",
      message: `Delete secret "${selectedSecret.name}"?`,
      onConfirm: () => {
        void performDelete(selectedSecret.id);
      },
      title: "Delete secret",
    });
  };

  const performDelete = async (secretId: string) => {
    setPending(true);
    setFormError(null);

    try {
      await sdk.secrets.delete({
        id: secretId,
      });
      const remainingSecrets = secrets.filter(
        (secret) => secret.id !== secretId,
      );

      setSecrets(remainingSecrets);
      setSelectedSecretId(remainingSecrets[0]?.id ?? null);
      setCreating(remainingSecrets.length === 0);
      marbleToast.success("Secret deleted");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <MarbleCard className="min-h-[32rem]">
        <MarbleCardHeader
          actions={[
            {
              children: "New secret",
              iconLeft: PlusIcon,
              onClick: handleStartCreate,
              variant: "light",
            },
          ]}
        >
          <MarbleCardTitle>Secrets in this project</MarbleCardTitle>
        </MarbleCardHeader>
        <MarbleCardContent className="min-h-0 px-0 pb-0">
          {secrets.length === 0 ? (
            <div className="px-5 pb-5">
              <MarbleEmptyState
                description="Create a named secret once, then point programs or columns at it."
                title="No secrets yet"
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-b-[inherit] border-t border-taupe-200">
              {secrets.map((secret) => (
                <MarbleListRow
                  active={!creating && selectedSecretId === secret.id}
                  align="start"
                  description={
                    <div className="space-y-1">
                      <div className="text-[11px] text-zinc-400">
                        Updated{" "}
                        {DATE_TIME_FORMATTER.format(new Date(secret.updatedAt))}
                      </div>
                    </div>
                  }
                  icon={<KeyIcon size={16} />}
                  iconTone="neutral"
                  key={secret.id}
                  meta={
                    <MarbleBadge
                      caps
                      tone={
                        secret.category === "Managed" ? "warning" : "neutral"
                      }
                    >
                      {secret.category === "Managed" ? "Managed" : "User"}
                    </MarbleBadge>
                  }
                  onClick={() => {
                    setCreating(false);
                    setSelectedSecretId(secret.id);
                  }}
                  title={secret.name}
                  tone="orange"
                />
              ))}
            </div>
          )}
        </MarbleCardContent>
      </MarbleCard>

      <MarbleCard
        className="min-h-[32rem]"
        tone="subtle"
      >
        <MarbleCardHeader>
          <MarbleCardTitle>
            {creating
              ? "New secret"
              : (selectedSecret?.name ?? "Secret details")}
          </MarbleCardTitle>
        </MarbleCardHeader>
        <MarbleCardContent className="gap-4">
          <MarbleAlert tone="neutral">
            Secrets are treated as sensitive values: they are stored securely
            and never shown in the UI.
          </MarbleAlert>

          <MarbleField label="Name">
            <MarbleInput
              disabled={pending}
              onChange={(event) => setDraftName(event.target.value)}
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
              onChange={(event) => setDraftValue(event.target.value)}
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
                    selectedSecret.category === "Managed"
                      ? "warning"
                      : "neutral"
                  }
                >
                  {selectedSecret.category}
                </MarbleBadge>
              </div>
            </MarbleAlert>
          ) : null}

          {formError ? (
            <MarbleAlert tone="error">{formError}</MarbleAlert>
          ) : null}
        </MarbleCardContent>
        <MarbleCardFooter>
          <MarbleButton
            disabled={pending || creating || !selectedSecret}
            iconLeft={TrashIcon}
            onClick={handleDelete}
            variant="red"
          >
            Delete
          </MarbleButton>

          <MarbleButton
            className={cx("min-w-32")}
            disabled={pending}
            onClick={handleSave}
            variant="orange"
          >
            {pending ? "Saving..." : creating ? "Create secret" : "Save"}
          </MarbleButton>
        </MarbleCardFooter>
      </MarbleCard>

      <MarbleConfirmModal
        onClose={() => setConfirmState(null)}
        state={confirmState}
      />
    </div>
  );
}
