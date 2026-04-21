"use client";

import {
  cx,
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  type MarbleButtonProps,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
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
  CopyIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from "@phosphor-icons/react/dist/ssr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  AGENT_PROFILE_ICON_OPTIONS,
  AGENT_PROVIDER_OPTIONS,
  DEFAULT_AGENT_PROFILE_ICON,
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
  const iconValue = formData.get("icon");
  const name = typeof nameValue === "string" ? nameValue.trim() : "";

  if (!name) {
    throw new Error("Profile name is required.");
  }

  return {
    external_name:
      typeof externalNameValue === "string" && externalNameValue.trim()
        ? externalNameValue.trim()
        : null,
    icon:
      typeof iconValue === "string" && iconValue.trim()
        ? iconValue.trim()
        : DEFAULT_AGENT_PROFILE_ICON,
    name,
  } satisfies Pick<ProfileRecord, "external_name" | "icon" | "name">;
}

function compareByCreatedAtAsc(
  left: Pick<ProfileRecord, "created_at">,
  right: Pick<ProfileRecord, "created_at">,
) {
  return (
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

function resolveAgentProfileIcon(profile: Pick<ProfileRecord, "icon">) {
  return profile.icon ?? DEFAULT_AGENT_PROFILE_ICON;
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
  selectedIcon,
  onSelectIcon,
}: {
  defaults?: {
    externalName?: null | string;
    name?: string;
  };
  disabled?: boolean;
  onSelectIcon: (icon: string) => void;
  selectedIcon: string;
}) {
  return (
    <div className="space-y-4">
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

      <div className="space-y-2">
        <MarbleFieldLabel>Icon</MarbleFieldLabel>
        <MarbleCard tone="subtle">
          <MarbleCardContent className="space-y-3 px-4 py-4">
            <input
              name="icon"
              type="hidden"
              value={selectedIcon}
            />

            <div className="flex items-center gap-3 rounded-xs border border-zinc-200 bg-white/90 px-3 py-3">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xs border border-taupe-200 bg-linear-to-br from-white via-taupe-50 to-orange-50 text-3xl">
                <span aria-hidden="true">{selectedIcon}</span>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm text-zinc-900">
                  Profile icon
                </p>
                <p className="text-sm text-zinc-600">
                  Choose the emoji that should represent this agent everywhere
                  ownership is shown.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {AGENT_PROFILE_ICON_OPTIONS.map((icon) => {
                const isSelected = icon === selectedIcon;

                return (
                  <button
                    aria-label={`Select ${icon} as the profile icon`}
                    aria-pressed={isSelected}
                    className={cx(
                      "flex aspect-square items-center justify-center rounded-xs border text-2xl transition-colors",
                      isSelected
                        ? "border-orange-300 bg-orange-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                        : "border-zinc-200 bg-white/90 hover:border-zinc-300 hover:bg-zinc-50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                    disabled={disabled}
                    key={icon}
                    onClick={() => onSelectIcon(icon)}
                    type="button"
                  >
                    <span aria-hidden="true">{icon}</span>
                  </button>
                );
              })}
            </div>
          </MarbleCardContent>
        </MarbleCard>
      </div>
    </div>
  );
}

function ProfileAvatar({
  profile,
}: {
  profile: Pick<ProfileRecord, "icon" | "type">;
}) {
  if (profile.type === "Human") {
    return (
      <div className="flex aspect-square w-20 shrink-0 items-center justify-center rounded-xs border-4 border-taupe-900 bg-taupe-600 sm:w-24">
        <UserIcon
          className="size-14 fill-white sm:size-16"
          weight="duotone"
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-square w-20 shrink-0 items-center justify-center rounded-xs border border-taupe-200 bg-linear-to-br from-white via-taupe-50 to-orange-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:w-24">
      <span
        aria-hidden="true"
        className="text-[2.25rem] leading-none"
      >
        {resolveAgentProfileIcon(profile)}
      </span>
    </div>
  );
}

function ProfileSummary({
  extraBadges,
  profile,
}: {
  extraBadges?: ReactNode;
  profile: ManagedProfileRecord;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <MarbleCardTitle className="text-lg text-taupe-950">
          {profile.name}
        </MarbleCardTitle>
        <MarbleBadge
          caps
          tone={profile.type === "Human" ? "solid" : "neutral"}
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
        {extraBadges}
      </div>
      <MarbleCardDescription>
        Created {CREATED_AT_FORMATTER.format(new Date(profile.created_at))}
      </MarbleCardDescription>
    </>
  );
}

function ProfileRow({
  children,
  profile,
}: {
  children: ReactNode;
  profile: ManagedProfileRecord;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[6rem_minmax(0,1fr)] md:items-start">
      <ProfileAvatar profile={profile} />
      {children}
    </div>
  );
}

function KeyList({
  createDisabled,
  createLabel,
  createVariant = "light",
  keys,
  onCreateKey,
  onRevokeKey,
  revokingKeyId,
}: {
  createDisabled: boolean;
  createLabel: string;
  createVariant?: MarbleButtonProps["variant"];
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
    <div className="space-y-4">
      <div className="flex justify-end">
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
        <MarbleAlert tone="neutral">No keys yet for this profile.</MarbleAlert>
      ) : (
        <div className="overflow-hidden rounded-sm border border-zinc-200 bg-white/80">
          {visibleKeys.map((key) => (
            <MarbleListRow
              align="start"
              aside={
                key.deleted_at ? null : (
                  <MarbleButton
                    disabled={Boolean(key.deleted_at || revokingKeyId)}
                    onClick={() => onRevokeKey(key)}
                    size="sm"
                    type="button"
                    variant="red"
                  >
                    {revokingKeyId === key.id ? "Revoking" : "Revoke"}
                  </MarbleButton>
                )
              }
              description={
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500">
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
                  tone={key.deleted_at ? "error" : "success"}
                >
                  {key.deleted_at ? "Revoked" : "Active"}
                </MarbleBadge>
              }
              size="compact"
              title={<span className="font-mono text-sm">{key.preview}</span>}
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

function ProfileEditorModal({
  confirmLabel,
  defaults,
  description,
  disabled = false,
  formRef,
  onClose,
  onSelectIcon,
  onSubmit,
  selectedIcon,
  submitVariant = "orange",
  title,
}: {
  confirmLabel: string;
  defaults?: {
    externalName?: null | string;
    name?: string;
  };
  description: string;
  disabled?: boolean;
  formRef?: React.RefObject<HTMLFormElement | null>;
  onClose: () => void;
  onSelectIcon: (icon: string) => void;
  onSubmit: (formData: FormData) => void;
  selectedIcon: string;
  submitVariant?: MarbleButtonProps["variant"];
  title: string;
}) {
  return (
    <MarbleModal
      ariaLabel={title}
      onClose={onClose}
      size="md"
    >
      <form
        action={onSubmit}
        ref={formRef}
      >
        <MarbleModalHeader>
          <MarbleModalTitle className="text-base">{title}</MarbleModalTitle>
        </MarbleModalHeader>
        <MarbleModalContent className="space-y-4">
          <MarbleModalDescription>{description}</MarbleModalDescription>
          <AgentProfileFields
            defaults={defaults}
            disabled={disabled}
            onSelectIcon={onSelectIcon}
            selectedIcon={selectedIcon}
          />
        </MarbleModalContent>
        <MarbleModalFooter>
          <MarbleButton
            disabled={disabled}
            onClick={onClose}
            size="sm"
            type="button"
          >
            Cancel
          </MarbleButton>
          <MarbleButton
            disabled={disabled}
            size="sm"
            type="submit"
            variant={submitVariant}
          >
            {confirmLabel}
          </MarbleButton>
        </MarbleModalFooter>
      </form>
    </MarbleModal>
  );
}

function NewKeyModal({
  copied,
  onClose,
  onCopy,
  profileName,
  token,
}: {
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
  profileName: string;
  token: string;
}) {
  return (
    <MarbleModal
      ariaLabel={`New key for ${profileName}`}
      onClose={onClose}
      size="md"
    >
      <MarbleModalHeader>
        <MarbleModalTitle className="text-base">
          New key for {profileName}
        </MarbleModalTitle>
      </MarbleModalHeader>
      <MarbleModalContent className="space-y-4">
        <MarbleModalDescription>
          Store this token somewhere safe now. The full value is shown only
          once.
        </MarbleModalDescription>

        <MarbleAlert tone="warning">
          Copy the key before closing this modal.
        </MarbleAlert>

        <MarbleCard tone="subtle">
          <MarbleCardHeader className="border-zinc-100 border-b px-4 py-3">
            <MarbleCardTitle className="text-sm">API key</MarbleCardTitle>
            <MarbleCardDescription>{profileName}</MarbleCardDescription>
          </MarbleCardHeader>
          <MarbleCardContent className="px-4 py-4">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xs border border-zinc-200 bg-white px-3 py-3 font-mono text-sm text-zinc-950">
              {token}
            </pre>
          </MarbleCardContent>
        </MarbleCard>
      </MarbleModalContent>
      <MarbleModalFooter>
        <MarbleButton
          onClick={onClose}
          size="sm"
          type="button"
        >
          Close
        </MarbleButton>
        <MarbleButton
          iconLeft={CopyIcon}
          onClick={onCopy}
          size="sm"
          type="button"
          variant="orange"
        >
          {copied ? "Copied" : "Copy key"}
        </MarbleButton>
      </MarbleModalFooter>
    </MarbleModal>
  );
}

export function ProfilesPageView({
  initialProfiles,
  userId,
}: {
  initialProfiles: ManagedProfileRecord[];
  userId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [optimisticProfiles, addOptimisticProfile] = useOptimistic(
    profiles,
    (current, optimisticProfile: ManagedProfileRecord) =>
      upsertProfile(current, optimisticProfile),
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createDraftIcon, setCreateDraftIcon] = useState(
    DEFAULT_AGENT_PROFILE_ICON,
  );
  const [editingId, setEditingId] = useState<null | string>(null);
  const [editingDraftIcon, setEditingDraftIcon] = useState(
    DEFAULT_AGENT_PROFILE_ICON,
  );
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

  const resetCreateModal = () => {
    createFormRef.current?.reset();
    setCreateDraftIcon(DEFAULT_AGENT_PROFILE_ICON);
  };

  const closeCreateModal = () => {
    if (createPending) {
      return;
    }

    setIsCreateModalOpen(false);
    resetCreateModal();
  };

  const openCreateModal = () => {
    resetCreateModal();
    setError(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (profile: ManagedProfileRecord) => {
    setEditingDraftIcon(resolveAgentProfileIcon(profile));
    setEditingId(profile.id);
    setError(null);
  };

  const closeEditModal = () => {
    if (savingId) {
      return;
    }

    setEditingId(null);
    setEditingDraftIcon(DEFAULT_AGENT_PROFILE_ICON);
  };

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
      icon: draft.icon,
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
        setIsCreateModalOpen(false);
        resetCreateModal();
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
      closeEditModal();
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
  const editingProfile =
    editingId === null
      ? null
      : (agentProfiles.find((profile) => profile.id === editingId) ?? null);

  useEffect(() => {
    if (editingId && !editingProfile) {
      setEditingId(null);
      setEditingDraftIcon(DEFAULT_AGENT_PROFILE_ICON);
    }
  }, [
    editingId,
    editingProfile,
  ]);

  useEffect(() => {
    const editProfileId = searchParams.get("edit");

    if (!editProfileId) {
      return;
    }

    const profile = agentProfiles.find(
      (candidate) => candidate.id === editProfileId,
    );

    if (!profile) {
      return;
    }

    setEditingDraftIcon(resolveAgentProfileIcon(profile));
    setEditingId(profile.id);
    setError(null);
    router.replace(pathname);
  }, [
    agentProfiles,
    pathname,
    router,
    searchParams,
  ]);

  return (
    <div className="space-y-6 pb-12">
      {error ? <MarbleAlert tone="error">{error}</MarbleAlert> : null}

      {lastCreatedKey ? (
        <NewKeyModal
          copied={copiedLastCreatedKey}
          onClose={handleDismissLastCreatedKey}
          onCopy={() => void handleCopyLastCreatedKey()}
          profileName={lastCreatedKey.profileName}
          token={lastCreatedKey.token}
        />
      ) : null}

      {isCreateModalOpen ? (
        <ProfileEditorModal
          confirmLabel={createPending ? "Creating profile" : "Create profile"}
          description="Name the profile for the job it does, label the provider, and pick the icon that should identify it in the list."
          disabled={createPending}
          formRef={createFormRef}
          onClose={closeCreateModal}
          onSelectIcon={setCreateDraftIcon}
          onSubmit={handleCreate}
          selectedIcon={createDraftIcon}
          submitVariant="orange"
          title="Create agent profile"
        />
      ) : null}

      {editingProfile ? (
        <ProfileEditorModal
          confirmLabel={
            savingId === editingProfile.id ? "Saving changes" : "Save changes"
          }
          defaults={{
            externalName: editingProfile.external_name,
            name: editingProfile.name,
          }}
          description="Adjust the name, provider label, or icon shown for this agent profile."
          disabled={savingId === editingProfile.id}
          key={editingProfile.id}
          onClose={closeEditModal}
          onSelectIcon={setEditingDraftIcon}
          onSubmit={(formData) => {
            void handleUpdate(editingProfile.id, formData);
          }}
          selectedIcon={editingDraftIcon}
          submitVariant="dark"
          title={`Edit ${editingProfile.name}`}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h2 className="font-medium text-base text-zinc-950">
              Agent profiles
            </h2>
            <p className="text-sm text-zinc-600">
              Keep one profile per working agent so keys, events, and ownership
              stay legible.
            </p>
          </div>
          <MarbleButton
            iconLeft={PlusIcon}
            onClick={openCreateModal}
            size="sm"
            type="button"
            variant="orange"
          >
            Create new
          </MarbleButton>
        </div>

        {agentProfiles.length === 0 ? (
          <MarbleCard>
            <MarbleCardContent className="px-5 py-5">
              <MarbleEmptyState
                description="Create your first agent profile, then mint keys inside the profile card itself."
                title="No agent profiles yet"
              />
            </MarbleCardContent>
          </MarbleCard>
        ) : (
          <div className="space-y-3">
            {agentProfiles.map((profile) => {
              const isDeleting = deletingId === profile.id;
              const isSaving = savingId === profile.id;
              const isTemporary = isOptimisticId(profile.id);

              return (
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                >
                  <MarbleCard
                    className="min-w-0 overflow-visible"
                    tone={isTemporary ? "subtle" : "default"}
                  >
                    <MarbleCardHeader
                      className="border-zinc-100 border-b px-5 py-4"
                      disclosureActions={[
                        {
                          description:
                            "Rename it, relabel its provider, or swap the icon.",
                          disabled: isDeleting || isSaving || isTemporary,
                          icon: (
                            <PencilSimpleIcon
                              size={14}
                              weight="bold"
                            />
                          ),
                          label: "Edit name",
                          onSelect: () => openEditModal(profile),
                        },
                        {
                          description:
                            "Only works when nothing else still belongs to it.",
                          disabled:
                            isDeleting ||
                            isSaving ||
                            creatingKeyProfileId === profile.id ||
                            isTemporary,
                          icon: (
                            <TrashIcon
                              size={14}
                              weight="bold"
                            />
                          ),
                          label: isDeleting ? "Deleting" : "Delete profile",
                          onSelect: () => void handleDelete(profile),
                          tone: "danger",
                        },
                      ]}
                      disclosureAriaLabel={`Open actions for ${profile.name}`}
                    >
                      <ProfileSummary profile={profile} />
                    </MarbleCardHeader>

                    <MarbleCardContent className="px-5 pb-5 pt-4">
                      <KeyList
                        createDisabled={Boolean(
                          creatingKeyProfileId || isDeleting || isTemporary,
                        )}
                        createLabel={
                          creatingKeyProfileId === profile.id
                            ? "Creating key"
                            : "Create key"
                        }
                        keys={profile.keys}
                        onCreateKey={() => void handleCreateKey(profile)}
                        onRevokeKey={(key) =>
                          void handleRevokeKey(profile, key)
                        }
                        revokingKeyId={revokingKeyId}
                      />
                    </MarbleCardContent>
                  </MarbleCard>
                </ProfileRow>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-medium text-base text-zinc-950">
            Your human profile
          </h2>
          <p className="text-sm text-zinc-600">
            This profile is created automatically for your own use. Only mint
            keys here when you are operating Marble directly as a human.
          </p>
        </div>

        {primaryHumanProfile ? (
          <ProfileRow profile={primaryHumanProfile}>
            <MarbleCard
              className="min-w-0 overflow-visible"
              tone="subtle"
            >
              <MarbleCardHeader
                className="border-zinc-100 border-b px-5 py-4"
                disclosureActions={[
                  {
                    description:
                      "The automatic human profile is fixed to your account.",
                    disabled: true,
                    icon: (
                      <PencilSimpleIcon
                        size={14}
                        weight="bold"
                      />
                    ),
                    label: "Edit name",
                    onSelect: () => undefined,
                  },
                  {
                    description:
                      "Human profiles are created automatically and cannot be deleted here.",
                    disabled: true,
                    icon: (
                      <TrashIcon
                        size={14}
                        weight="bold"
                      />
                    ),
                    label: "Delete profile",
                    onSelect: () => undefined,
                    tone: "danger",
                  },
                ]}
                disclosureAriaLabel="Open human profile actions"
              >
                <ProfileSummary profile={primaryHumanProfile} />
              </MarbleCardHeader>

              <MarbleCardContent className="px-5 pb-5 pt-4">
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
                  keys={primaryHumanProfile.keys}
                  onCreateKey={() => void handleCreateKey(primaryHumanProfile)}
                  onRevokeKey={(key) =>
                    void handleRevokeKey(primaryHumanProfile, key)
                  }
                  revokingKeyId={revokingKeyId}
                />
              </MarbleCardContent>
            </MarbleCard>
          </ProfileRow>
        ) : (
          <MarbleCard tone="subtle">
            <MarbleCardContent className="px-5 py-5">
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
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                >
                  <MarbleCard
                    className="min-w-0 overflow-visible"
                    tone="subtle"
                  >
                    <MarbleCardHeader
                      className="border-zinc-100 border-b px-5 py-4"
                      disclosureActions={[
                        {
                          description:
                            "This extra human profile remains read-only here.",
                          disabled: true,
                          icon: (
                            <PencilSimpleIcon
                              size={14}
                              weight="bold"
                            />
                          ),
                          label: "Edit name",
                          onSelect: () => undefined,
                        },
                        {
                          description:
                            "Human profiles are not removable from this screen.",
                          disabled: true,
                          icon: (
                            <TrashIcon
                              size={14}
                              weight="bold"
                            />
                          ),
                          label: "Delete profile",
                          onSelect: () => undefined,
                          tone: "danger",
                        },
                      ]}
                      disclosureAriaLabel={`Open actions for ${profile.name}`}
                    >
                      <ProfileSummary
                        extraBadges={
                          <MarbleBadge
                            caps
                            tone="warning"
                          >
                            Unexpected
                          </MarbleBadge>
                        }
                        profile={profile}
                      />
                    </MarbleCardHeader>

                    <MarbleCardContent className="px-5 pb-5 pt-4">
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
                        keys={profile.keys}
                        onCreateKey={() => void handleCreateKey(profile)}
                        onRevokeKey={(key) =>
                          void handleRevokeKey(profile, key)
                        }
                        revokingKeyId={revokingKeyId}
                      />
                    </MarbleCardContent>
                  </MarbleCard>
                </ProfileRow>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
