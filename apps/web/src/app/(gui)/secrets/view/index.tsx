"use client";

import {
  MarbleConfirmModal,
  type MarbleConfirmModalState,
  marbleToast,
} from "@marble/ui";
import { useEffect, useState } from "react";
import { useMarbleWebSessionSdk } from "../../../../lib/marble-sdk-client";
import type { SecretRecord } from "../actions";
import { SecretEditor } from "./editor";
import { SecretList } from "./list";

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

  const handleSelect = (secretId: string) => {
    setCreating(false);
    setSelectedSecretId(secretId);
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
      <SecretList
        creating={creating}
        onCreate={handleStartCreate}
        onSelect={handleSelect}
        secrets={secrets}
        selectedSecretId={selectedSecretId}
      />

      <SecretEditor
        creating={creating}
        draftName={draftName}
        draftValue={draftValue}
        formError={formError}
        onDelete={handleDelete}
        onNameChange={setDraftName}
        onSave={handleSave}
        onValueChange={setDraftValue}
        pending={pending}
        selectedSecret={selectedSecret}
      />

      <MarbleConfirmModal
        onClose={() => setConfirmState(null)}
        state={confirmState}
      />
    </div>
  );
}
