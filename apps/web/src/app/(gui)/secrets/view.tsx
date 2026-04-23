"use client";

import {
  cx,
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleEmptyState,
  MarbleFieldLabel,
  MarbleInput,
  MarbleListRow,
  marbleToast,
} from "@marble/ui";
import { KeyIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import * as actions from "./actions";

type SecretRecord = Awaited<ReturnType<typeof actions.listSecrets>>[number];

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
      new Date(right.updated_at).getTime() -
        new Date(left.updated_at).getTime(),
  );
}

export function SecretsPageView({
  initialSecrets,
}: {
  initialSecrets: SecretRecord[];
}) {
  const [secrets, setSecrets] = useState(() => sortSecrets(initialSecrets));
  const [selectedSecretId, setSelectedSecretId] = useState<string | null>(
    initialSecrets[0]?.id ?? null,
  );
  const [creating, setCreating] = useState(initialSecrets.length === 0);
  const [draftName, setDraftName] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
        const created = await actions.createSecret({
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
        marbleToast.success("Secret saved to Vault");
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

      const updated = await actions.updateSecret(selectedSecret.id, {
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

  const handleDelete = async () => {
    if (!selectedSecret || pending) {
      return;
    }

    if (!window.confirm(`Delete secret "${selectedSecret.name}"?`)) {
      return;
    }

    setPending(true);
    setFormError(null);

    try {
      await actions.deleteSecret(selectedSecret.id);
      const remainingSecrets = secrets.filter(
        (secret) => secret.id !== selectedSecret.id,
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
              children: (
                <span className="inline-flex items-center gap-2">
                  <PlusIcon size={14} />
                  New secret
                </span>
              ),
              onClick: handleStartCreate,
              variant: "light",
            },
          ]}
        >
          <MarbleCardTitle>Vault entries</MarbleCardTitle>
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
                      <div>Stored in Vault.</div>
                      <div className="text-[11px] text-zinc-400">
                        Updated{" "}
                        {DATE_TIME_FORMATTER.format(
                          new Date(secret.updated_at),
                        )}
                      </div>
                    </div>
                  }
                  icon={
                    <div className="flex size-9 items-center justify-center rounded-xs border border-taupe-200 bg-white/80 text-taupe-600">
                      <KeyIcon size={16} />
                    </div>
                  }
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
        <MarbleCardContent className="flex h-full min-h-0 flex-col gap-4">
          <MarbleAlert tone="neutral">
            Secret values are written into Vault. Existing values are never
            shown again here.
          </MarbleAlert>

          <div className="space-y-1.5">
            <MarbleFieldLabel>Name</MarbleFieldLabel>
            <MarbleInput
              disabled={pending}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="e.g. OPENAI_API_KEY"
              type="text"
              value={draftName}
              wrapperClassName="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <MarbleFieldLabel>
              {creating ? "Secret value" : "Replace value"}
            </MarbleFieldLabel>
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
          </div>

          {selectedSecret && !creating ? (
            <div className="rounded-xs border border-taupe-200 bg-white/70 px-3 py-2 text-xs text-taupe-600">
              <div className="flex items-center justify-between gap-3">
                <span>Stored under your account.</span>
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
            </div>
          ) : null}

          {formError ? (
            <MarbleAlert tone="error">{formError}</MarbleAlert>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-taupe-200 pt-4">
            <MarbleButton
              disabled={pending || creating || !selectedSecret}
              onClick={handleDelete}
              variant="red"
            >
              <span className="inline-flex items-center gap-2">
                <TrashIcon size={14} />
                Delete
              </span>
            </MarbleButton>

            <MarbleButton
              className={cx("min-w-32")}
              disabled={pending}
              onClick={handleSave}
              variant="orange"
            >
              {pending ? "Saving..." : creating ? "Create secret" : "Save"}
            </MarbleButton>
          </div>
        </MarbleCardContent>
      </MarbleCard>
    </div>
  );
}
