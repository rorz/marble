"use client";

import type { Database } from "@marble/supabase";
import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleEmptyState,
  MarbleFieldLabel,
  MarbleInput,
  MarbleSelect,
} from "@marble/ui";
import {
  startTransition,
  useEffect,
  useEffectEvent,
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

type BusyAction =
  | null
  | {
      kind: "create";
    }
  | {
      kind: "delete" | "update";
      profileId: string;
    };
type DisplayProfile = ProfileRecord & {
  optimisticState?: "creating" | "updating";
};
type Feedback = null | {
  text: string;
  tone: "error" | "success";
};
type OptimisticMutation =
  | {
      kind: "create";
      profile: DisplayProfile;
    }
  | {
      draft: ProfileDraft;
      kind: "update";
      profileId: string;
    }
  | {
      kind: "delete";
      profileId: string;
    };
type ProfileDraft = {
  externalName: null | string;
  name: string;
  type: ProfileRecord["type"];
};
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function readProfileDraft(formData: FormData): ProfileDraft {
  const nameValue = formData.get("name");
  const externalNameValue = formData.get("externalName");
  const typeValue = formData.get("type");
  const name = typeof nameValue === "string" ? nameValue.trim() : "";

  if (!name) {
    throw new Error("Profile name is required.");
  }

  return {
    externalName:
      typeof externalNameValue === "string" && externalNameValue.trim()
        ? externalNameValue.trim()
        : null,
    name,
    type: typeValue === "Human" ? "Human" : "Agent",
  };
}

function sortProfiles<T extends Pick<ProfileRecord, "created_at">>(
  profiles: T[],
) {
  return [
    ...profiles,
  ].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );
}

function upsertProfile(
  current: ProfileRecord[],
  profile: ProfileRecord,
): ProfileRecord[] {
  return sortProfiles([
    profile,
    ...current.filter((candidate) => candidate.id !== profile.id),
  ]);
}

function applyOptimisticMutation(
  current: DisplayProfile[],
  mutation: OptimisticMutation,
): DisplayProfile[] {
  if (mutation.kind === "create") {
    return sortProfiles([
      mutation.profile,
      ...current.filter((profile) => profile.id !== mutation.profile.id),
    ]);
  }

  if (mutation.kind === "update") {
    return current.map((profile) =>
      profile.id === mutation.profileId
        ? {
            ...profile,
            external_name: mutation.draft.externalName,
            name: mutation.draft.name,
            optimisticState: "updating",
            type: mutation.draft.type,
          }
        : profile,
    );
  }

  return current.filter((profile) => profile.id !== mutation.profileId);
}

function buildOptimisticProfile(
  draft: ProfileDraft,
  userId: string,
): DisplayProfile {
  const timestamp = new Date().toISOString();

  return {
    created_at: timestamp,
    external_name: draft.externalName,
    id: `temp:${crypto.randomUUID()}`,
    name: draft.name,
    optimisticState: "creating",
    owner_user_id: userId,
    type: draft.type,
    updated_at: timestamp,
  };
}

function ProfileFields({
  defaults,
  disabled,
}: {
  defaults?: Partial<ProfileDraft>;
  disabled?: boolean;
}) {
  return (
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
  );
}

export function ProfilesPageView({
  initialProfiles,
  userId,
}: {
  initialProfiles: ProfileRecord[];
  userId: string;
}) {
  const createFormRef = useRef<HTMLFormElement>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [editingProfileId, setEditingProfileId] = useState<null | string>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [profiles, setProfiles] = useState(() => sortProfiles(initialProfiles));
  const [realtimeStatus, setRealtimeStatus] = useState<
    "connecting" | "error" | "live"
  >("connecting");
  const [supabase] = useState(() => createClient());
  const [optimisticProfiles, addOptimisticProfile] = useOptimistic<
    DisplayProfile[],
    OptimisticMutation
  >(profiles, applyOptimisticMutation);

  const reconcileProfiles = useEffectEvent(
    (payload: RealtimePayload<ProfileRecord>) => {
      setProfiles((current) => {
        if (payload.eventType === "DELETE") {
          const deletedId = payload.old.id;

          if (typeof deletedId !== "string") {
            return current;
          }

          return current.filter((profile) => profile.id !== deletedId);
        }

        const profile = payload.new;

        if (
          typeof profile.id !== "string" ||
          typeof profile.created_at !== "string" ||
          typeof profile.name !== "string" ||
          typeof profile.owner_user_id !== "string" ||
          (profile.type !== "Agent" && profile.type !== "Human") ||
          typeof profile.updated_at !== "string"
        ) {
          return current;
        }

        return upsertProfile(current, {
          created_at: profile.created_at,
          external_name:
            typeof profile.external_name === "string"
              ? profile.external_name
              : null,
          id: profile.id,
          name: profile.name,
          owner_user_id: profile.owner_user_id,
          type: profile.type,
          updated_at: profile.updated_at,
        });
      });
    },
  );

  useEffect(() => {
    const channel = supabase
      .channel(`profiles-2:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profile",
        },
        (payload) => {
          reconcileProfiles(payload as RealtimePayload<ProfileRecord>);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("live");
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("error");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    supabase,
    userId,
  ]);

  const runMutation = async <Result,>({
    action,
    busy,
    onSuccess,
    optimistic,
  }: {
    action: () => Promise<Result>;
    busy: BusyAction;
    onSuccess: (result: Result) => void;
    optimistic: OptimisticMutation;
  }) => {
    setBusyAction(busy);
    setFeedback(null);
    addOptimisticProfile(optimistic);

    try {
      const result = await action();
      onSuccess(result);
    } catch (error) {
      setProfiles((current) => [
        ...current,
      ]);
      setFeedback({
        text: getErrorMessage(error),
        tone: "error",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreate = (formData: FormData) => {
    let draft: ProfileDraft;

    try {
      draft = readProfileDraft(formData);
    } catch (error) {
      setFeedback({
        text: getErrorMessage(error),
        tone: "error",
      });
      return;
    }
    startTransition(() => {
      void runMutation({
        action: () => createProfileAction(formData),
        busy: {
          kind: "create",
        },
        onSuccess: (createdProfile) => {
          setProfiles((current) => upsertProfile(current, createdProfile));
          setFeedback({
            text: `Created ${createdProfile.name}.`,
            tone: "success",
          });
          createFormRef.current?.reset();
        },
        optimistic: {
          kind: "create",
          profile: buildOptimisticProfile(draft, userId),
        },
      });
    });
  };

  const handleUpdate = (profileId: string, formData: FormData) => {
    let draft: ProfileDraft;

    try {
      draft = readProfileDraft(formData);
    } catch (error) {
      setFeedback({
        text: getErrorMessage(error),
        tone: "error",
      });
      return;
    }

    startTransition(() => {
      void runMutation({
        action: () => updateProfileAction(profileId, formData),
        busy: {
          kind: "update",
          profileId,
        },
        onSuccess: (updatedProfile) => {
          setEditingProfileId(null);
          setProfiles((current) => upsertProfile(current, updatedProfile));
          setFeedback({
            text: `Saved ${updatedProfile.name}.`,
            tone: "success",
          });
        },
        optimistic: {
          draft,
          kind: "update",
          profileId,
        },
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

    startTransition(() => {
      void runMutation({
        action: () => deleteProfileAction(profile.id),
        busy: {
          kind: "delete",
          profileId: profile.id,
        },
        onSuccess: ({ id }) => {
          setEditingProfileId((current) => (current === id ? null : current));
          setProfiles((current) =>
            current.filter((candidate) => candidate.id !== id),
          );
          setFeedback({
            text: `Deleted ${profile.name}.`,
            tone: "success",
          });
        },
        optimistic: {
          kind: "delete",
          profileId: profile.id,
        },
      });
    });
  };

  return (
    <div className="space-y-6">
      <MarbleCard tone="orange">
        <MarbleCardHeader className="gap-3 border-b border-orange-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <MarbleCardTitle className="text-base">Profiles</MarbleCardTitle>
              <MarbleCardDescription>
                Server-rendered on first load, optimistic during mutations, and
                kept in sync over Supabase Realtime without `router.refresh()`.
              </MarbleCardDescription>
            </div>

            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
              <MarbleBadge tone="solid">
                {optimisticProfiles.length} total
              </MarbleBadge>
              <MarbleBadge
                tone={
                  realtimeStatus === "live"
                    ? "success"
                    : realtimeStatus === "error"
                      ? "error"
                      : "neutral"
                }
              >
                {realtimeStatus === "live"
                  ? "Realtime live"
                  : realtimeStatus === "error"
                    ? "Realtime error"
                    : "Connecting"}
              </MarbleBadge>
            </div>
          </div>
        </MarbleCardHeader>

        <MarbleCardContent className="space-y-4 pt-5">
          {feedback ? (
            <MarbleAlert tone={feedback.tone === "error" ? "error" : "success"}>
              {feedback.text}
            </MarbleAlert>
          ) : null}

          <form
            action={handleCreate}
            className="space-y-4"
            ref={createFormRef}
          >
            <ProfileFields disabled={busyAction?.kind === "create"} />

            <div className="flex justify-end">
              <MarbleButton
                disabled={busyAction?.kind === "create"}
                type="submit"
                variant="orange"
              >
                {busyAction?.kind === "create" ? "Creating" : "Create profile"}
              </MarbleButton>
            </div>
          </form>
        </MarbleCardContent>
      </MarbleCard>

      {optimisticProfiles.length === 0 ? (
        <MarbleCard>
          <MarbleCardContent>
            <MarbleEmptyState
              description="Create one above to watch the list update locally and across tabs."
              title="No profiles yet"
            />
          </MarbleCardContent>
        </MarbleCard>
      ) : (
        <div className="grid gap-4">
          {optimisticProfiles.map((profile) => {
            const isEditing = editingProfileId === profile.id;
            const isDeleting =
              busyAction?.kind === "delete" &&
              busyAction.profileId === profile.id;
            const isSaving =
              busyAction?.kind === "update" &&
              busyAction.profileId === profile.id;

            return (
              <MarbleCard
                className="overflow-visible"
                key={profile.id}
                tone={profile.optimisticState ? "subtle" : "default"}
              >
                <MarbleCardHeader className="gap-3 border-b border-zinc-100">
                  <div className="flex flex-wrap items-start justify-between gap-3">
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
                        {profile.optimisticState ? (
                          <MarbleBadge
                            caps
                            tone="info"
                          >
                            {profile.optimisticState}
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

                    <div className="flex gap-2">
                      <MarbleButton
                        disabled={isDeleting || profile.id.startsWith("temp:")}
                        onClick={() =>
                          setEditingProfileId((current) =>
                            current === profile.id ? null : profile.id,
                          )
                        }
                        variant="light"
                      >
                        {isEditing ? "Close" : "Edit"}
                      </MarbleButton>
                      <MarbleButton
                        disabled={
                          isDeleting ||
                          isSaving ||
                          profile.id.startsWith("temp:")
                        }
                        onClick={() => handleDelete(profile)}
                        variant="red"
                      >
                        {isDeleting ? "Deleting" : "Delete"}
                      </MarbleButton>
                    </div>
                  </div>
                </MarbleCardHeader>

                {isEditing ? (
                  <MarbleCardContent className="space-y-4 pt-5">
                    <form
                      action={(formData) => handleUpdate(profile.id, formData)}
                      className="space-y-4"
                    >
                      <ProfileFields
                        defaults={{
                          externalName: profile.external_name,
                          name: profile.name,
                          type: profile.type,
                        }}
                        disabled={isSaving}
                      />

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
