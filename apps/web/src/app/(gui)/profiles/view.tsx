"use client";

import type { Database } from "@marble/supabase";
import {
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleContextPopover,
  MarbleFieldLabel,
  MarbleInput,
  MarbleSelect,
} from "@marble/ui";
import {
  startTransition,
  useEffect,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { createClient } from "../../../lib/supabase/browser";
import {
  createProfileAction,
  deleteProfileAction,
  updateProfileAction,
} from "./actions";

type ProfileRecord = Pick<
  Database["public"]["Tables"]["profile"]["Row"],
  | "created_at"
  | "external_name"
  | "id"
  | "name"
  | "owner_user_id"
  | "type"
  | "updated_at"
>;
type RealtimePayload<Row> = {
  eventType: "DELETE" | "INSERT" | "UPDATE";
  new: Partial<Row>;
  old: Partial<Row>;
};

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

function upsertProfile(current: ProfileRecord[], profile: ProfileRecord) {
  return [
    profile,
    ...current.filter((candidate) => candidate.id !== profile.id),
  ].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
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
                ? current.filter((profile) => profile.id !== change.old.id)
                : current;
            }

            const next = change.new;
            if (
              typeof next.id !== "string" ||
              typeof next.created_at !== "string" ||
              typeof next.name !== "string" ||
              typeof next.owner_user_id !== "string" ||
              (next.type !== "Agent" && next.type !== "Human") ||
              typeof next.updated_at !== "string"
            ) {
              return current;
            }

            return upsertProfile(current, {
              created_at: next.created_at,
              external_name:
                typeof next.external_name === "string"
                  ? next.external_name
                  : null,
              id: next.id,
              name: next.name,
              owner_user_id: next.owner_user_id,
              type: next.type,
              updated_at: next.updated_at,
            });
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
      id: `temp:${crypto.randomUUID()}`,
      name: draft.name,
      owner_user_id: userId,
      type: draft.type,
      updated_at: new Date().toISOString(),
    });
    setCreatePending(true);
    setError(null);

    startTransition(() => {
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
    });
  };

  const handleUpdate = (profileId: string, formData: FormData) => {
    setSavingId(profileId);
    setError(null);

    startTransition(() => {
      void updateProfileAction(profileId, formData)
        .then((updatedProfile) => {
          setProfiles((current) => upsertProfile(current, updatedProfile));
          setEditingId(null);
        })
        .catch((caughtError) => {
          setError(getErrorMessage(caughtError));
        })
        .finally(() => {
          setSavingId(null);
        });
    });
  };

  const handleDelete = (profile: ProfileRecord) => {
    if (
      !window.confirm(
        `Delete ${profile.name}? This only succeeds if nothing else still belongs to it.`,
      )
    ) {
      return;
    }

    setDeletingId(profile.id);
    setError(null);

    startTransition(() => {
      void deleteProfileAction(profile.id)
        .then(() => {
          setProfiles((current) =>
            current.filter((candidate) => candidate.id !== profile.id),
          );
          setEditingId((current) => (current === profile.id ? null : current));
        })
        .catch((caughtError) => {
          setError(getErrorMessage(caughtError));
        })
        .finally(() => {
          setDeletingId(null);
        });
    });
  };

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
          {error ? (
            <div className="rounded-xs border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
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
          <MarbleCardContent className="py-10 text-center">
            <p className="font-medium text-sm text-zinc-900">No profiles yet</p>
          </MarbleCardContent>
        </MarbleCard>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {optimisticProfiles
            .sort((a, b) => +(b.type === "Human") - +(a.type === "Human"))
            .map((profile) => {
              const isEditing = editingId === profile.id;
              const isSaving = savingId === profile.id;
              const isDeleting = deletingId === profile.id;
              const isTemporary = profile.id.startsWith("temp:");

              return (
                <MarbleCard
                  className="overflow-visible"
                  key={profile.id}
                  tone={isTemporary ? "subtle" : "default"}
                >
                  <MarbleCardHeader className="border-b border-zinc-100">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <MarbleCardTitle className="text-base">
                            {profile.name}
                          </MarbleCardTitle>
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600 uppercase tracking-[0.18em]">
                            {profile.type}
                          </span>
                          {profile.external_name ? (
                            <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] text-orange-700 uppercase tracking-[0.18em]">
                              {profile.external_name}
                            </span>
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
                            onSelect: () => handleDelete(profile),
                            tone: "danger",
                          },
                        ]}
                      />
                    </div>
                  </MarbleCardHeader>

                  {isEditing ? (
                    <MarbleCardContent className="pt-5">
                      <form
                        action={(formData) =>
                          handleUpdate(profile.id, formData)
                        }
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
