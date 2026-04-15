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
  deleteProfileAction,
  updateProfileAction,
} from "./actions";
import type { ProfileRecord } from "./shared";

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

function upsertProfile(current: ProfileRecord[], profile: ProfileRecord) {
  return upsertRow(current, profile, compareByCreatedAtDesc);
}

export function ProfilesPageView({
  initialProfiles,
  userId,
}: {
  initialProfiles: ProfileRecord[];
  userId: string;
}) {
  const createFormRef = useRef<HTMLFormElement>(null);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [optimisticProfiles, addOptimisticProfile] = useOptimistic(
    profiles,
    (current, optimisticProfile: ProfileRecord) =>
      upsertProfile(current, optimisticProfile),
  );
  const [createPending, setCreatePending] = useState(false);
  const [editingId, setEditingId] = useState<null | string>(null);
  const [savingId, setSavingId] = useState<null | string>(null);
  const [deletingId, setDeletingId] = useState<null | string>(null);
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

  const handleDelete = async (profile: ProfileRecord) => {
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
        <div className="grid grid-cols-2 gap-2">
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
                          disabled: isDeleting || isSaving || isTemporary,
                          label: isDeleting ? "Deleting" : "Delete",
                          onSelect: () => void handleDelete(profile),
                          tone: "danger",
                        },
                      ]}
                      triggerClassName="size-6 text-zinc-300 hover:bg-transparent hover:text-zinc-500"
                    />
                  </div>
                </MarbleCardHeader>

                {isEditing ? (
                  <MarbleCardContent className="pt-5">
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
