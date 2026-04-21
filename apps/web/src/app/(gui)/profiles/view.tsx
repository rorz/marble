"use client";

import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  type MarbleButtonProps,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleContextPopover,
  MarbleEmptyState,
  MarbleFieldLabel,
  MarbleInput,
  MarbleListRow,
  MarbleModal,
  MarbleModalContent,
  MarbleModalDescription,
  MarbleModalFooter,
  MarbleModalHeader,
  MarbleModalTitle,
  MarbleSearchSelect,
} from "@marble/ui";
import {
  type ReactNode,
  useEffect,
  useOptimistic,
  useRef,
  useState,
} from "react";
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
import {
  AGENT_PROVIDER_OPTIONS,
  type ManagedProfileRecord,
  type ProfileKeyRecord,
  type ProfileRecord,
} from "./shared";

const CREATED_AT_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});
const VISIBLE_KEY_COUNT = 3;

function readProfileDraft(formData: FormData) {
  const nameValue = formData.get("name");
  const externalNameValue = formData.get("externalName");
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
  } satisfies Pick<ProfileRecord, "external_name" | "name">;
}

function compareByCreatedAtAsc(
  left: Pick<ProfileRecord, "created_at">,
  right: Pick<ProfileRecord, "created_at">,
) {
  return (
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
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

function AgentProfileFields({
  defaults,
  disabled = false,
}: {
  defaults?: {
    externalName?: null | string;
    name?: string;
  };
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div>
        <MarbleFieldLabel>Profile name</MarbleFieldLabel>
        <MarbleInput
          defaultValue={defaults?.name ?? ""}
          disabled={disabled}
          name="name"
          placeholder="Docs triage agent"
        />
      </div>

      <div>
        <MarbleFieldLabel>Agent provider</MarbleFieldLabel>
        <MarbleSearchSelect
          defaultValue={defaults?.externalName ?? ""}
          disabled={disabled}
          name="externalName"
          options={AGENT_PROVIDER_OPTIONS}
          placeholder="Search providers like Codex or Claude Code"
          wrapperClassName="w-full"
        />
      </div>
    </div>
  );
}

function ProfileIdentity({
  createdAt,
  extraBadges,
  profileId,
  profileName,
  profileType,
}: {
  createdAt: string;
  extraBadges?: ReactNode;
  profileId: string;
  profileName: string;
  profileType: ProfileRecord["type"];
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <MarbleCardTitle className="text-base">{profileName}</MarbleCardTitle>
        <MarbleBadge
          caps
          tone={profileType === "Human" ? "solid" : "neutral"}
        >
          {profileType}
        </MarbleBadge>
        {extraBadges}
      </div>
      <MarbleCardDescription className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
        <span>{profileId}</span>
        <span>Created {createdAt}</span>
      </MarbleCardDescription>
    </div>
  );
}

function KeyList({
  createDisabled,
  createLabel,
  createVariant = "light",
  helperText,
  keys,
  onCreateKey,
  onRevokeKey,
  revokingKeyId,
}: {
  createDisabled: boolean;
  createLabel: string;
  createVariant?: MarbleButtonProps["variant"];
  helperText: string;
  keys: ProfileKeyRecord[];
  onCreateKey: () => void;
  onRevokeKey: (key: ProfileKeyRecord) => void;
  revokingKeyId: null | string;
}) {
  const [isShowingAllKeys, setIsShowingAllKeys] = useState(false);
  const hiddenKeyCount = Math.max(keys.length - VISIBLE_KEY_COUNT, 0);
  const visibleKeys = isShowingAllKeys
    ? keys
    : keys.slice(0, VISIBLE_KEY_COUNT);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <MarbleFieldLabel className="mb-0">API keys</MarbleFieldLabel>
          <p className="text-sm text-zinc-600">{helperText}</p>
        </div>
        <MarbleButton
          disabled={createDisabled}
          onClick={onCreateKey}
          size="sm"
          type="button"
          variant={createVariant}
        >
          {createLabel}
        </MarbleButton>
      </div>

      {keys.length === 0 ? (
        <MarbleAlert tone="neutral">No keys yet.</MarbleAlert>
      ) : (
        <div className="overflow-hidden rounded-sm border border-zinc-200 bg-white/80">
          {visibleKeys.map((key) => (
            <MarbleListRow
              align="start"
              aside={
                <MarbleButton
                  disabled={Boolean(key.deleted_at || revokingKeyId)}
                  onClick={() => onRevokeKey(key)}
                  size="sm"
                  type="button"
                  variant="red"
                >
                  {revokingKeyId === key.id ? "Revoking" : "Revoke"}
                </MarbleButton>
              }
              description={
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500">
                  <span>{key.id}</span>
                  <span>
                    Created{" "}
                    {CREATED_AT_FORMATTER.format(new Date(key.created_at))}
                  </span>
                  {key.deleted_at ? (
                    <span>
                      Revoked{" "}
                      {CREATED_AT_FORMATTER.format(new Date(key.deleted_at))}
                    </span>
                  ) : null}
                </div>
              }
              key={key.id}
              meta={
                <MarbleBadge
                  caps
                  tone={key.deleted_at ? "warning" : "success"}
                >
                  {key.deleted_at ? "Revoked" : "Active"}
                </MarbleBadge>
              }
              size="compact"
              title={<span className="font-mono">{key.preview}</span>}
              tone="neutral"
            />
          ))}
          {hiddenKeyCount > 0 ? (
            <div className="border-zinc-200 border-t px-3 py-2">
              <MarbleButton
                onClick={() => setIsShowingAllKeys((current) => !current)}
                size="sm"
                type="button"
              >
                {isShowingAllKeys
                  ? "Hide extra keys"
                  : `View all keys (${hiddenKeyCount} more)`}
              </MarbleButton>
            </div>
          ) : null}
        </div>
      )}
    </div>
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
    let draft: ReturnType<typeof readProfileDraft>;

    try {
      draft = readProfileDraft(formData);
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
      type: "Agent",
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

  const handleDismissLastCreatedKey = () => {
    setLastCreatedKey(null);
    setCopiedLastCreatedKey(false);
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

  const humanProfiles = [
    ...optimisticProfiles.filter((profile) => profile.type === "Human"),
  ].sort(compareByCreatedAtAsc);
  const agentProfiles = sortRows(
    optimisticProfiles.filter((profile) => profile.type === "Agent"),
    compareByCreatedAtDesc,
  );
  const primaryHumanProfile = humanProfiles[0] ?? null;
  const additionalHumanProfiles = humanProfiles.slice(1);

  return (
    <div className="space-y-4 pb-12">
      {error ? <MarbleAlert tone="error">{error}</MarbleAlert> : null}

      {lastCreatedKey ? (
        <MarbleModal
          ariaLabel={`New key for ${lastCreatedKey.profileName}`}
          onClose={handleDismissLastCreatedKey}
          size="md"
        >
          <MarbleModalHeader>
            <MarbleModalTitle>
              New key for {lastCreatedKey.profileName}
            </MarbleModalTitle>
          </MarbleModalHeader>
          <MarbleModalContent className="space-y-4">
            <MarbleModalDescription>
              Copy it now. The full token is only shown once.
            </MarbleModalDescription>
            <pre className="overflow-x-auto rounded-sm bg-emerald-950 px-3 py-3 font-mono text-emerald-100 text-xs">
              {lastCreatedKey.token}
            </pre>
          </MarbleModalContent>
          <MarbleModalFooter>
            <MarbleButton
              onClick={handleDismissLastCreatedKey}
              size="sm"
              type="button"
            >
              Close
            </MarbleButton>
            <MarbleButton
              onClick={() => void handleCopyLastCreatedKey()}
              size="sm"
              type="button"
              variant="orange"
            >
              {copiedLastCreatedKey ? "Copied" : "Copy key"}
            </MarbleButton>
          </MarbleModalFooter>
        </MarbleModal>
      ) : null}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-medium text-base text-zinc-950">
            Your human profile
          </h2>
          <p className="text-sm text-zinc-600">
            This profile is for your own use as a human, and was created
            automatically with your Marble account. Only create API keys here
            when you're working on Marble directly yourself.
          </p>
        </div>

        {primaryHumanProfile ? (
          <MarbleCard tone="subtle">
            <MarbleCardHeader className="border-b border-zinc-100 px-4 py-4">
              <ProfileIdentity
                createdAt={CREATED_AT_FORMATTER.format(
                  new Date(primaryHumanProfile.created_at),
                )}
                profileId={primaryHumanProfile.id}
                profileName={primaryHumanProfile.name}
                profileType={primaryHumanProfile.type}
              />
            </MarbleCardHeader>
            <MarbleCardContent className="space-y-4 px-4 pb-4 pt-4">
              <KeyList
                createDisabled={Boolean(
                  creatingKeyProfileId ||
                    isOptimisticId(primaryHumanProfile.id),
                )}
                createLabel={
                  creatingKeyProfileId === primaryHumanProfile.id
                    ? "Creating key"
                    : "Create key"
                }
                createVariant="dark"
                helperText="Only create a key here when you're directly operating Marble yourself."
                keys={primaryHumanProfile.keys}
                onCreateKey={() => void handleCreateKey(primaryHumanProfile)}
                onRevokeKey={(key) =>
                  void handleRevokeKey(primaryHumanProfile, key)
                }
                revokingKeyId={revokingKeyId}
              />
            </MarbleCardContent>
          </MarbleCard>
        ) : (
          <MarbleCard tone="subtle">
            <MarbleCardContent className="px-4 py-4">
              <MarbleAlert tone="warning">
                Marble expected an automatic human profile here, but none was
                found for this account.
              </MarbleAlert>
            </MarbleCardContent>
          </MarbleCard>
        )}

        {additionalHumanProfiles.length > 0 ? (
          <>
            <MarbleAlert tone="warning">
              Expected one automatic human profile, but found{" "}
              {additionalHumanProfiles.length + 1}. Showing the extras below so
              they remain visible.
            </MarbleAlert>

            <div className="space-y-3">
              {additionalHumanProfiles.map((profile) => (
                <MarbleCard
                  key={profile.id}
                  tone="subtle"
                >
                  <MarbleCardHeader className="border-b border-zinc-100 px-4 py-4">
                    <ProfileIdentity
                      createdAt={CREATED_AT_FORMATTER.format(
                        new Date(profile.created_at),
                      )}
                      extraBadges={
                        <MarbleBadge
                          caps
                          tone="warning"
                        >
                          Unexpected
                        </MarbleBadge>
                      }
                      profileId={profile.id}
                      profileName={profile.name}
                      profileType={profile.type}
                    />
                  </MarbleCardHeader>
                  <MarbleCardContent className="space-y-4 px-4 pb-4 pt-4">
                    <MarbleCardDescription>
                      This extra human profile predates the agent-only flow and
                      is shown here for visibility.
                    </MarbleCardDescription>
                    <KeyList
                      createDisabled={Boolean(
                        creatingKeyProfileId || isOptimisticId(profile.id),
                      )}
                      createLabel={
                        creatingKeyProfileId === profile.id
                          ? "Creating key"
                          : "Create key"
                      }
                      createVariant="dark"
                      helperText="Only create a key here when you're directly operating Marble yourself."
                      keys={profile.keys}
                      onCreateKey={() => void handleCreateKey(profile)}
                      onRevokeKey={(key) => void handleRevokeKey(profile, key)}
                      revokingKeyId={revokingKeyId}
                    />
                  </MarbleCardContent>
                </MarbleCard>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-3">
        <MarbleCard tone="orange">
          <MarbleCardHeader className="border-b border-orange-100 px-4 py-4">
            <MarbleCardTitle className="text-base">
              Create agent profile
            </MarbleCardTitle>
            <MarbleCardDescription>
              Name the profile for the job it does. Provider is just a source
              label so you can tell Codex apart from Claude Code, OpenCode, and
              the rest.
            </MarbleCardDescription>
          </MarbleCardHeader>
          <MarbleCardContent className="space-y-4 px-4 pb-4 pt-4">
            <form
              action={handleCreate}
              className="space-y-4"
              ref={createFormRef}
            >
              <AgentProfileFields disabled={createPending} />
              <div className="flex justify-end">
                <MarbleButton
                  disabled={createPending}
                  size="sm"
                  type="submit"
                  variant="orange"
                >
                  {createPending ? "Creating profile" : "Create agent profile"}
                </MarbleButton>
              </div>
            </form>
          </MarbleCardContent>
        </MarbleCard>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-medium text-base text-zinc-950">
            Agent profiles
          </h2>
          <p className="text-sm text-zinc-600">
            Keep one profile per working agent so keys, events, and ownership
            stay legible.
          </p>
        </div>

        {agentProfiles.length === 0 ? (
          <MarbleCard>
            <MarbleCardContent className="px-4 py-4">
              <MarbleEmptyState
                description="Create your first agent profile above, then mint keys inside the profile card itself."
                title="No agent profiles yet"
              />
            </MarbleCardContent>
          </MarbleCard>
        ) : (
          <div className="space-y-3">
            {agentProfiles.map((profile) => {
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
                  <MarbleCardHeader className="relative border-b border-zinc-100 px-4 py-4">
                    <div className="pr-8">
                      <ProfileIdentity
                        createdAt={CREATED_AT_FORMATTER.format(
                          new Date(profile.created_at),
                        )}
                        extraBadges={
                          profile.external_name ? (
                            <MarbleBadge
                              caps
                              tone="warning"
                            >
                              {profile.external_name}
                            </MarbleBadge>
                          ) : null
                        }
                        profileId={profile.id}
                        profileName={profile.name}
                        profileType={profile.type}
                      />
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
                  </MarbleCardHeader>

                  <MarbleCardContent className="space-y-4 px-4 pb-4 pt-4">
                    {!profile.external_name ? (
                      <MarbleCardDescription>
                        No provider label set. That's okay if the profile name
                        already makes the owner obvious.
                      </MarbleCardDescription>
                    ) : null}

                    <KeyList
                      createDisabled={Boolean(
                        creatingKeyProfileId || isDeleting || isTemporary,
                      )}
                      createLabel={
                        creatingKeyProfileId === profile.id
                          ? "Creating key"
                          : "Create key"
                      }
                      helperText="Create keys inside the profile they belong to so agent activity stays attributable."
                      keys={profile.keys}
                      onCreateKey={() => void handleCreateKey(profile)}
                      onRevokeKey={(key) => void handleRevokeKey(profile, key)}
                      revokingKeyId={revokingKeyId}
                    />
                  </MarbleCardContent>

                  {isEditing ? (
                    <MarbleCardContent className="border-t border-zinc-100 px-4 pb-4 pt-4">
                      <form
                        action={(formData) =>
                          handleUpdate(profile.id, formData)
                        }
                        className="space-y-4"
                      >
                        <AgentProfileFields
                          defaults={{
                            externalName: profile.external_name,
                            name: profile.name,
                          }}
                          disabled={isSaving}
                        />
                        <div className="flex justify-end">
                          <MarbleButton
                            disabled={isSaving}
                            size="sm"
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
      </section>
    </div>
  );
}
