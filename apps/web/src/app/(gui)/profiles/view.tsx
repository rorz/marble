"use client";

import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleContextPopover,
  MarbleEmptyState,
  MarbleFieldLabel,
  MarbleInput,
  MarbleSelect,
} from "@marble/ui";
import { useEffect, useOptimistic, useRef, useState } from "react";
import {
  compareByCreatedAtDesc,
  getErrorMessage,
  isOptimisticId,
  makeOptimisticId,
  type RealtimePayload,
  removeRow,
  sortRows,
  upsertRow,
} from "../../../lib/realtime-crud";
import { createClient } from "../../../lib/supabase/browser";
import {
  createProfileAction,
  createProfileKeyAction,
  deleteProfileAction,
  revokeProfileKeyAction,
  updateProfileAction,
} from "./actions";
import type {
  ManagedProfileRecord,
  ProfileKeyRecord,
  ProfileRecord,
} from "./shared";

const CREATED_AT_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

function readDraft(formData: FormData) {
  const nameValue = formData.get("name");
  const externalNameValue = formData.get("externalName");
  const typeValue = formData.get("type");
  const name = typeof nameValue === "string" ? nameValue.trim() : "";

  if (!name) {
    throw new Error("Profile name is required.");
  }

  return {
    external_name:
      typeof externalNameValue === "string" && externalNameValue.trim()
        ? externalNameValue.trim()
        : null,
    name,
    type: typeValue === "Human" ? "Human" : "Agent",
  } satisfies Pick<ProfileRecord, "external_name" | "name" | "type">;
}

function compareProfiles(left: ProfileRecord, right: ProfileRecord) {
  return left.type === right.type
    ? compareByCreatedAtDesc(left, right)
    : +(right.type === "Human") - +(left.type === "Human");
}

function upsertProfile(
  current: ManagedProfileRecord[],
  profile: ManagedProfileRecord | ProfileRecord,
) {
  const existing = current.find((entry) => entry.id === profile.id);

  return upsertRow(
    current,
    "keys" in profile
      ? profile
      : {
          ...profile,
          keys: existing?.keys ?? [],
        },
    compareByCreatedAtDesc,
  );
}

function upsertProfileKey(keys: ProfileKeyRecord[], key: ProfileKeyRecord) {
  return sortRows(
    upsertRow(keys, key, compareByCreatedAtDesc),
    compareByCreatedAtDesc,
  );
}

export function ProfilesPageView({
  initialProfiles,
  userId,
}: {
  initialProfiles: ManagedProfileRecord[];
  userId: string;
}) {
  const createFormRef = useRef<HTMLFormElement>(null);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [optimisticProfiles, addOptimisticProfile] = useOptimistic(
    profiles,
    (current, optimisticProfile: ManagedProfileRecord) =>
      upsertProfile(current, optimisticProfile),
  );
  const [createPending, setCreatePending] = useState(false);
  const [editingId, setEditingId] = useState<null | string>(null);
  const [savingId, setSavingId] = useState<null | string>(null);
  const [deletingId, setDeletingId] = useState<null | string>(null);
  const [creatingKeyProfileId, setCreatingKeyProfileId] = useState<
    null | string
  >(null);
  const [revokingKeyId, setRevokingKeyId] = useState<null | string>(null);
  const [lastCreatedKey, setLastCreatedKey] = useState<null | {
    profileName: string;
    token: string;
  }>(null);
  const [copiedLastCreatedKey, setCopiedLastCreatedKey] = useState(false);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`profile-4:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profile",
        },
        (payload) => {
          const change = payload as RealtimePayload<ProfileRecord>;

          setProfiles((current) => {
            if (change.eventType === "DELETE") {
              return typeof change.old.id === "string"
                ? removeRow(current, change.old.id)
                : current;
            }

            const next = change.new as ProfileRecord;

            if (next.owner_user_id !== userId) {
              return current;
            }

            return upsertProfile(current, next);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    userId,
  ]);

  const handleCreate = (formData: FormData) => {
    let draft: ReturnType<typeof readDraft>;

    try {
      draft = readDraft(formData);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      return;
    }

    addOptimisticProfile({
      created_at: new Date().toISOString(),
      external_name: draft.external_name,
      id: makeOptimisticId(),
      keys: [],
      name: draft.name,
      owner_user_id: userId,
      type: draft.type,
      updated_at: new Date().toISOString(),
    });
    setCreatePending(true);
    setError(null);

    void createProfileAction(formData)
      .then((createdProfile) => {
        setProfiles((current) => upsertProfile(current, createdProfile));
        createFormRef.current?.reset();
      })
      .catch((caughtError) => {
        setProfiles((current) => [
          ...current,
        ]);
        setError(getErrorMessage(caughtError));
      })
      .finally(() => {
        setCreatePending(false);
      });
  };

  const handleUpdate = async (profileId: string, formData: FormData) => {
    setSavingId(profileId);
    setError(null);

    try {
      const updatedProfile = await updateProfileAction(profileId, formData);
      setProfiles((current) => upsertProfile(current, updatedProfile));
      setEditingId(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (profile: ManagedProfileRecord) => {
    if (
      !window.confirm(
        `Delete ${profile.name}? This only succeeds if nothing else still belongs to it.`,
      )
    ) {
      return;
    }

    setDeletingId(profile.id);
    setError(null);

    try {
      await deleteProfileAction(profile.id);
      setProfiles((current) => removeRow(current, profile.id));
      setEditingId((current) => (current === profile.id ? null : current));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateKey = async (profile: ManagedProfileRecord) => {
    setCreatingKeyProfileId(profile.id);
    setError(null);

    try {
      const created = await createProfileKeyAction(profile.id);
      setProfiles((current) =>
        current.map((entry) =>
          entry.id === created.profileId
            ? {
                ...entry,
                keys: upsertProfileKey(entry.keys, created.key),
              }
            : entry,
        ),
      );
      setCopiedLastCreatedKey(false);
      setLastCreatedKey({
        profileName: created.profileName,
        token: created.token,
      });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setCreatingKeyProfileId(null);
    }
  };

  const handleCopyLastCreatedKey = async () => {
    if (!lastCreatedKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(lastCreatedKey.token);
      setCopiedLastCreatedKey(true);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const handleRevokeKey = async (
    profile: ManagedProfileRecord,
    key: ProfileKeyRecord,
  ) => {
    if (
      !window.confirm(`Revoke ${key.preview}? Existing CLI sessions will fail.`)
    ) {
      return;
    }

    setRevokingKeyId(key.id);
    setError(null);

    try {
      const revoked = await revokeProfileKeyAction(key.id);
      setProfiles((current) =>
        current.map((entry) =>
          entry.id === profile.id
            ? {
                ...entry,
                keys: entry.keys.map((entryKey) =>
                  entryKey.id === key.id
                    ? {
                        ...entryKey,
                        deleted_at: revoked.revokedAt,
                      }
                    : entryKey,
                ),
              }
            : entry,
        ),
      );
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setRevokingKeyId(null);
    }
  };

  const visibleProfiles = sortRows(optimisticProfiles, compareProfiles);

  return (
    <div className="space-y-6">
      <MarbleCard tone="orange">
        <MarbleCardHeader className="border-b border-orange-100">
          <MarbleCardTitle className="text-base">Profiles</MarbleCardTitle>
          <MarbleCardDescription>
            Server-loaded, optimistic on create, realtime-synced.
          </MarbleCardDescription>
        </MarbleCardHeader>
        <MarbleCardContent className="space-y-4 pt-5">
          {error ? <MarbleAlert tone="error">{error}</MarbleAlert> : null}

          {lastCreatedKey ? (
            <MarbleAlert tone="success">
              <div className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm text-emerald-950">
                      New key for {lastCreatedKey.profileName}
                    </p>
                    <p className="text-sm text-emerald-900/80">
                      Copy it now. The full token is only shown once.
                    </p>
                  </div>
                  <MarbleButton
                    onClick={() => void handleCopyLastCreatedKey()}
                    size="sm"
                    type="button"
                    variant="dark"
                  >
                    {copiedLastCreatedKey ? "Copied" : "Copy key"}
                  </MarbleButton>
                </div>
                <pre className="overflow-x-auto rounded-md bg-emerald-950 px-3 py-3 font-mono text-emerald-100 text-xs">
                  {lastCreatedKey.token}
                </pre>
              </div>
            </MarbleAlert>
          ) : null}

          <form
            action={handleCreate}
            className="space-y-4"
            ref={createFormRef}
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_180px]">
              <div>
                <MarbleFieldLabel>Profile name</MarbleFieldLabel>
                <MarbleInput
                  disabled={createPending}
                  name="name"
                  placeholder="Customer support agent"
                />
              </div>
              <div>
                <MarbleFieldLabel>External name</MarbleFieldLabel>
                <MarbleInput
                  disabled={createPending}
                  name="externalName"
                  placeholder="claude-code"
                />
              </div>
              <div>
                <MarbleFieldLabel>Type</MarbleFieldLabel>
                <MarbleSelect
                  defaultValue="Agent"
                  disabled={createPending}
                  name="type"
                >
                  <option value="Agent">Agent</option>
                  <option value="Human">Human</option>
                </MarbleSelect>
              </div>
            </div>
            <div className="flex justify-end">
              <MarbleButton
                disabled={createPending}
                type="submit"
                variant="orange"
              >
                {createPending ? "Creating" : "Create profile"}
              </MarbleButton>
            </div>
          </form>
        </MarbleCardContent>
      </MarbleCard>

      {optimisticProfiles.length === 0 ? (
        <MarbleCard>
          <MarbleCardContent>
            <MarbleEmptyState title="No profiles yet" />
          </MarbleCardContent>
        </MarbleCard>
      ) : (
        <div className="grid gap-2 xl:grid-cols-2">
          {visibleProfiles.map((profile) => {
            const isEditing = editingId === profile.id;
            const isSaving = savingId === profile.id;
            const isDeleting = deletingId === profile.id;
            const isTemporary = isOptimisticId(profile.id);

            return (
              <MarbleCard
                className="overflow-visible"
                key={profile.id}
                tone={isTemporary ? "subtle" : "default"}
              >
                <MarbleCardHeader className="relative border-b border-zinc-100">
                  <div className="space-y-2 pr-8">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <MarbleCardTitle className="text-base">
                          {profile.name}
                        </MarbleCardTitle>
                        <MarbleBadge
                          caps
                          tone="neutral"
                        >
                          {profile.type}
                        </MarbleBadge>
                        {profile.external_name ? (
                          <MarbleBadge
                            caps
                            tone="warning"
                          >
                            {profile.external_name}
                          </MarbleBadge>
                        ) : null}
                      </div>
                      <MarbleCardDescription className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                        <span>{profile.id}</span>
                        <span>
                          Created{" "}
                          {CREATED_AT_FORMATTER.format(
                            new Date(profile.created_at),
                          )}
                        </span>
                      </MarbleCardDescription>
                    </div>

                    <MarbleContextPopover
                      ariaLabel={`Open actions for ${profile.name}`}
                      className="absolute top-3 right-3"
                      items={[
                        {
                          disabled: isDeleting || isTemporary,
                          label: isEditing ? "Close editor" : "Edit",
                          onSelect: () =>
                            setEditingId((current) =>
                              current === profile.id ? null : profile.id,
                            ),
                        },
                        {
                          disabled:
                            isDeleting ||
                            isSaving ||
                            creatingKeyProfileId === profile.id ||
                            isTemporary,
                          label: isDeleting ? "Deleting" : "Delete",
                          onSelect: () => void handleDelete(profile),
                          tone: "danger",
                        },
                      ]}
                      triggerClassName="size-6 text-zinc-300 hover:bg-transparent hover:text-zinc-500"
                    />
                  </div>
                </MarbleCardHeader>

                <MarbleCardContent className="space-y-4 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <MarbleFieldLabel className="mb-0">
                        API keys
                      </MarbleFieldLabel>
                      <p className="text-sm text-zinc-600">
                        Mint a key for CLI and skill demos. Revoked keys stay
                        visible for auditability.
                      </p>
                    </div>
                    <MarbleButton
                      disabled={Boolean(
                        creatingKeyProfileId || isDeleting || isTemporary,
                      )}
                      onClick={() => void handleCreateKey(profile)}
                      size="sm"
                      type="button"
                    >
                      {creatingKeyProfileId === profile.id
                        ? "Creating"
                        : "Create key"}
                    </MarbleButton>
                  </div>

                  {profile.keys.length === 0 ? (
                    <MarbleAlert tone="neutral">No keys yet.</MarbleAlert>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-zinc-200">
                      {profile.keys.map((key) => (
                        <div
                          className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
                          key={key.id}
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-mono text-sm text-zinc-900">
                                {key.preview}
                              </p>
                              <MarbleBadge
                                caps
                                tone={key.deleted_at ? "warning" : "success"}
                              >
                                {key.deleted_at ? "Revoked" : "Active"}
                              </MarbleBadge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-zinc-500">
                              <span>{key.id}</span>
                              <span>
                                Created{" "}
                                {CREATED_AT_FORMATTER.format(
                                  new Date(key.created_at),
                                )}
                              </span>
                              {key.deleted_at ? (
                                <span>
                                  Revoked{" "}
                                  {CREATED_AT_FORMATTER.format(
                                    new Date(key.deleted_at),
                                  )}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <MarbleButton
                            disabled={Boolean(key.deleted_at || revokingKeyId)}
                            onClick={() => void handleRevokeKey(profile, key)}
                            size="sm"
                            type="button"
                            variant="red"
                          >
                            {revokingKeyId === key.id ? "Revoking" : "Revoke"}
                          </MarbleButton>
                        </div>
                      ))}
                    </div>
                  )}
                </MarbleCardContent>

                {isEditing ? (
                  <MarbleCardContent className="border-t border-zinc-100 pt-5">
                    <form
                      action={(formData) => handleUpdate(profile.id, formData)}
                      className="space-y-4"
                    >
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_180px]">
                        <div>
                          <MarbleFieldLabel>Profile name</MarbleFieldLabel>
                          <MarbleInput
                            defaultValue={profile.name}
                            disabled={isSaving}
                            name="name"
                          />
                        </div>
                        <div>
                          <MarbleFieldLabel>External name</MarbleFieldLabel>
                          <MarbleInput
                            defaultValue={profile.external_name ?? ""}
                            disabled={isSaving}
                            name="externalName"
                          />
                        </div>
                        <div>
                          <MarbleFieldLabel>Type</MarbleFieldLabel>
                          <MarbleSelect
                            defaultValue={profile.type}
                            disabled={isSaving}
                            name="type"
                          >
                            <option value="Agent">Agent</option>
                            <option value="Human">Human</option>
                          </MarbleSelect>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <MarbleButton
                          disabled={isSaving}
                          type="submit"
                          variant="dark"
                        >
                          {isSaving ? "Saving" : "Save changes"}
                        </MarbleButton>
                      </div>
                    </form>
                  </MarbleCardContent>
                ) : null}
              </MarbleCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
