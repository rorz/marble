"use client";

import {
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
} from "@marble/ui";
import { startTransition, useOptimistic, useRef, useState } from "react";
import {
  createProfileAction,
  deleteProfileAction,
  updateProfileAction,
} from "./actions";
import {
  buildOptimisticProfile,
  type ProfileDraft,
  type ProfileRecord,
  readProfileDraft,
  removeProfile,
  upsertProfile,
} from "./model";
import { ProfileForm } from "./profile-form";
import { useProfileList } from "./use-profile-list";

const CREATED_AT_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

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
  const { profiles, realtimeStatus, setProfiles } = useProfileList(
    initialProfiles,
    userId,
  );
  const [optimisticProfiles, addOptimisticProfile] = useOptimistic(
    profiles,
    (current, optimisticProfile: ProfileRecord) =>
      upsertProfile(current, optimisticProfile),
  );
  const [createPending, setCreatePending] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<null | string>(null);
  const [savePendingId, setSavePendingId] = useState<null | string>(null);
  const [deletePendingId, setDeletePendingId] = useState<null | string>(null);
  const [feedback, setFeedback] = useState<null | {
    text: string;
    tone: "error" | "success";
  }>(null);

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
      addOptimisticProfile(buildOptimisticProfile(draft, userId));
      setCreatePending(true);
      setFeedback(null);

      void createProfileAction(formData)
        .then((createdProfile) => {
          setProfiles((current) => upsertProfile(current, createdProfile));
          setFeedback({
            text: `Created ${createdProfile.name}.`,
            tone: "success",
          });
          createFormRef.current?.reset();
        })
        .catch((error) => {
          setProfiles((current) => [
            ...current,
          ]);
          setFeedback({
            text: getErrorMessage(error),
            tone: "error",
          });
        })
        .finally(() => {
          setCreatePending(false);
        });
    });
  };

  const handleUpdate = (profileId: string, formData: FormData) => {
    setSavePendingId(profileId);
    setFeedback(null);

    startTransition(() => {
      void updateProfileAction(profileId, formData)
        .then((updatedProfile) => {
          setProfiles((current) => upsertProfile(current, updatedProfile));
          setEditingProfileId(null);
          setFeedback({
            text: `Saved ${updatedProfile.name}.`,
            tone: "success",
          });
        })
        .catch((error) => {
          setFeedback({
            text: getErrorMessage(error),
            tone: "error",
          });
        })
        .finally(() => {
          setSavePendingId(null);
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

    setDeletePendingId(profile.id);
    setFeedback(null);

    startTransition(() => {
      void deleteProfileAction(profile.id)
        .then(() => {
          setProfiles((current) => removeProfile(current, profile.id));
          setEditingProfileId((current) =>
            current === profile.id ? null : current,
          );
          setFeedback({
            text: `Deleted ${profile.name}.`,
            tone: "success",
          });
        })
        .catch((error) => {
          setFeedback({
            text: getErrorMessage(error),
            tone: "error",
          });
        })
        .finally(() => {
          setDeletePendingId(null);
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
                Smaller surface area: server load, server actions, optimistic
                create, and realtime confirmation.
              </MarbleCardDescription>
            </div>

            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
              <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-zinc-600">
                {optimisticProfiles.length} total
              </span>
              <span
                className={
                  realtimeStatus === "live"
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700"
                    : realtimeStatus === "error"
                      ? "rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-700"
                      : "rounded-full border border-zinc-200 bg-zinc-100 px-2 py-1 text-zinc-600"
                }
              >
                {realtimeStatus === "live"
                  ? "Realtime live"
                  : realtimeStatus === "error"
                    ? "Realtime error"
                    : "Connecting"}
              </span>
            </div>
          </div>
        </MarbleCardHeader>

        <MarbleCardContent className="space-y-4 pt-5">
          {feedback ? (
            <div
              className={
                feedback.tone === "error"
                  ? "rounded-xs border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm"
                  : "rounded-xs border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm"
              }
            >
              {feedback.text}
            </div>
          ) : null}

          <ProfileForm
            action={handleCreate}
            disabled={createPending}
            formRef={createFormRef}
            submitLabel="Create profile"
            submittingLabel="Creating"
            tone="orange"
          />
        </MarbleCardContent>
      </MarbleCard>

      {optimisticProfiles.length === 0 ? (
        <MarbleCard>
          <MarbleCardContent className="py-10 text-center">
            <p className="font-medium text-sm text-zinc-900">No profiles yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Create one above to watch local optimism and realtime
              reconciliation.
            </p>
          </MarbleCardContent>
        </MarbleCard>
      ) : (
        <div className="grid gap-4">
          {optimisticProfiles.map((profile) => {
            const isEditing = editingProfileId === profile.id;
            const isDeleting = deletePendingId === profile.id;
            const isSaving = savePendingId === profile.id;
            const isTemporary = profile.id.startsWith("temp:");

            return (
              <MarbleCard
                className="overflow-visible"
                key={profile.id}
                tone={isTemporary ? "subtle" : "default"}
              >
                <MarbleCardHeader className="gap-3 border-b border-zinc-100">
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
                        {isTemporary ? (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-700 uppercase tracking-[0.18em]">
                            Creating
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

                    <div className="flex gap-2">
                      <MarbleButton
                        disabled={isDeleting || isTemporary}
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
                        disabled={isDeleting || isSaving || isTemporary}
                        onClick={() => handleDelete(profile)}
                        variant="red"
                      >
                        {isDeleting ? "Deleting" : "Delete"}
                      </MarbleButton>
                    </div>
                  </div>
                </MarbleCardHeader>

                {isEditing ? (
                  <MarbleCardContent className="pt-5">
                    <ProfileForm
                      action={(formData) => handleUpdate(profile.id, formData)}
                      defaults={{
                        externalName: profile.external_name,
                        name: profile.name,
                        type: profile.type,
                      }}
                      disabled={isSaving}
                      submitLabel="Save changes"
                      submittingLabel="Saving"
                    />
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
