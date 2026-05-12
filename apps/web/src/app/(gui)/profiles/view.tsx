"use client";

import { toCamelKeys } from "@marble/lib/object";
import type { MarbleClient } from "@marble/sdk";
import {
  MarbleAlert,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleConfirmModal,
  type MarbleConfirmModalState,
  MarbleCopyField,
  MarbleListRow,
  MarbleModal,
  MarbleModalClose,
  MarbleModalContent,
  MarbleModalDescription,
  MarbleModalFooter,
  MarbleModalHeader,
  MarbleModalTitle,
} from "@marble/ui";
import { RobotIcon, UserIcon } from "@phosphor-icons/react/dist/ssr";
import { type ReactNode, useState } from "react";
import { useMarbleWebSessionSdk } from "../../../lib/marble-sdk-client";
import {
  createBroadcastMutationGuard,
  type DeleteMutation,
  type UpsertMutation,
} from "../../../lib/realtime/broadcast-mutations";
import { usePrivateBroadcast } from "../../../lib/realtime/private-broadcast";
import {
  compareByCreatedAtCamelDesc,
  getErrorMessage,
  sortRows,
  upsertRow,
} from "../../../lib/realtime-crud";
import { changeTargetKey, getChangeTargetProps } from "../change-spotlight";
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
const VISIBLE_KEY_COUNT = 3;

type ProfileMutation =
  | DeleteMutation<"profile:delete", Record<string, unknown>>
  | UpsertMutation<"profile:upsert", Record<string, unknown>>;

const isProfileMutation = createBroadcastMutationGuard<ProfileMutation>({
  "profile:delete": true,
  "profile:upsert": true,
});

async function createProfileKey(
  sdk: MarbleClient,
  profile: ManagedProfileRecord,
) {
  const created = await sdk.keys.create({
    ownerProfileId: profile.id,
  });

  return {
    key: created.key,
    profileId: profile.id,
    profileName: profile.name,
    token: created.token,
  };
}

async function revokeProfileKey(sdk: MarbleClient, keyId: string) {
  const revoked = await sdk.keys.revoke({
    id: keyId,
  });

  return {
    id: keyId,
    revokedAt: revoked.deletedAt ?? new Date().toISOString(),
  };
}

function upsertProfileKey(keys: ProfileKeyRecord[], key: ProfileKeyRecord) {
  return sortRows(
    upsertRow(keys, key, compareByCreatedAtCamelDesc),
    compareByCreatedAtCamelDesc,
  );
}

function ProfileAvatar({ profile }: { profile: Pick<ProfileRecord, "type"> }) {
  const Icon = profile.type === "Human" ? UserIcon : RobotIcon;

  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-xs border border-taupe-700 bg-taupe-700">
      <Icon
        className="size-6 fill-white"
        weight="duotone"
      />
    </div>
  );
}

function ProfileHeading({ profile }: { profile: ManagedProfileRecord }) {
  const activeKeyCount = profile.keys.filter((key) => !key.deletedAt).length;

  return (
    <div className="flex min-w-0 items-start gap-3">
      <ProfileAvatar profile={profile} />
      <div className="min-w-0 space-y-1">
        <MarbleCardTitle className="truncate text-base leading-tight text-taupe-950">
          {profile.name}
        </MarbleCardTitle>
        <MarbleCardDescription className="text-xs">
          {activeKeyCount === 0
            ? "No active keys"
            : `${activeKeyCount} active key${activeKeyCount === 1 ? "" : "s"}`}
        </MarbleCardDescription>
      </div>
    </div>
  );
}

function KeyList({
  keys,
  onRevokeKey,
  revokingKeyId,
}: {
  keys: ProfileKeyRecord[];
  onRevokeKey: (key: ProfileKeyRecord) => void;
  revokingKeyId: null | string;
}) {
  const [isShowingAllKeys, setIsShowingAllKeys] = useState(false);
  const hiddenKeyCount = Math.max(keys.length - VISIBLE_KEY_COUNT, 0);
  const visibleKeys = isShowingAllKeys
    ? keys
    : keys.slice(0, VISIBLE_KEY_COUNT);

  if (keys.length === 0) {
    return (
      <div className="rounded-xs border border-dashed border-zinc-200 bg-white/70 px-3 py-2 text-xs text-zinc-500">
        No keys yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-sm border border-zinc-200 bg-white/80">
        {visibleKeys.map((key) => {
          const isRevoked = Boolean(key.deletedAt);
          const isThisKeyRevoking = revokingKeyId === key.id;
          const timestamp = isRevoked
            ? `Revoked ${CREATED_AT_FORMATTER.format(new Date(key.deletedAt ?? key.createdAt))}`
            : `Created ${CREATED_AT_FORMATTER.format(new Date(key.createdAt))}`;

          return (
            <MarbleListRow
              align="center"
              aside={
                isRevoked ? null : (
                  <MarbleButton
                    disabled={Boolean(revokingKeyId)}
                    onClick={() => onRevokeKey(key)}
                    size="xs"
                    type="button"
                    variant="light"
                  >
                    {isThisKeyRevoking ? "Revoking…" : "Revoke"}
                  </MarbleButton>
                )
              }
              description={timestamp}
              descriptionClassName={
                isRevoked
                  ? "mt-1 text-xs text-zinc-400"
                  : "mt-1 text-xs text-zinc-500"
              }
              key={key.id}
              size="sm"
              title={key.preview}
              titleClassName={
                isRevoked
                  ? "font-mono text-xs text-zinc-400 line-through"
                  : "font-mono text-xs text-taupe-900"
              }
              tone="neutral"
            />
          );
        })}
        {hiddenKeyCount > 0 ? (
          <div className="border-zinc-200 border-t px-3 py-2">
            <MarbleButton
              onClick={() => setIsShowingAllKeys((current) => !current)}
              size="xs"
              type="button"
            >
              {isShowingAllKeys
                ? "Hide extra keys"
                : `View all keys (${hiddenKeyCount} more)`}
            </MarbleButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProfileCard({
  mintLabel,
  mintVariant,
  onCreateKey,
  onRevokeKey,
  pendingKeyCreation,
  profile,
  revokingKeyId,
  tone,
}: {
  mintLabel: string;
  mintVariant: "dark" | "orange";
  onCreateKey: () => void;
  onRevokeKey: (key: ProfileKeyRecord) => void;
  pendingKeyCreation: boolean;
  profile: ManagedProfileRecord;
  revokingKeyId: null | string;
  tone: "default" | "orange" | "subtle";
}) {
  return (
    <MarbleCard
      className="flex h-full min-w-0 flex-col"
      tone={tone}
    >
      <MarbleCardHeader
        actions={[
          {
            children: pendingKeyCreation ? "Minting" : mintLabel,
            disabled: pendingKeyCreation,
            onClick: onCreateKey,
            size: "xs",
            type: "button",
            variant: mintVariant,
          },
        ]}
        divided
      >
        <ProfileHeading profile={profile} />
      </MarbleCardHeader>

      <MarbleCardContent className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-3">
        <KeyList
          keys={profile.keys}
          onRevokeKey={onRevokeKey}
          revokingKeyId={revokingKeyId}
        />
      </MarbleCardContent>
    </MarbleCard>
  );
}

function NewKeyModal({
  onClose,
  profileName,
  token,
}: {
  onClose: () => void;
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
        <MarbleModalTitle>New key for {profileName}</MarbleModalTitle>
        <MarbleModalClose onClick={onClose} />
      </MarbleModalHeader>
      <MarbleModalContent className="space-y-3">
        <MarbleModalDescription>
          This is the only time the full token is shown. Copy it now and store
          it somewhere secret.
        </MarbleModalDescription>
        <MarbleCopyField
          label="Token"
          value={token}
        />
      </MarbleModalContent>
      <MarbleModalFooter>
        <MarbleButton
          onClick={onClose}
          size="sm"
          type="button"
          variant="dark"
        >
          Done
        </MarbleButton>
      </MarbleModalFooter>
    </MarbleModal>
  );
}

export function ProfilesPageView({
  agent,
  human,
  userId,
}: {
  agent: ManagedProfileRecord;
  human: ManagedProfileRecord;
  userId: string;
}) {
  const sdk = useMarbleWebSessionSdk();
  const [pair, setPair] = useState<{
    agent: ManagedProfileRecord;
    human: ManagedProfileRecord;
  }>({
    agent,
    human,
  });
  const [creatingKeyProfileId, setCreatingKeyProfileId] = useState<
    null | string
  >(null);
  const [revokingKeyId, setRevokingKeyId] = useState<null | string>(null);
  const [lastCreatedKey, setLastCreatedKey] = useState<null | {
    profileName: string;
    token: string;
  }>(null);
  const [confirmState, setConfirmState] =
    useState<MarbleConfirmModalState | null>(null);
  const [error, setError] = useState<null | string>(null);

  usePrivateBroadcast({
    event: "profile_mutation",
    label: "Profiles",
    onMessage: (mutation) => {
      if (!isProfileMutation(mutation) || mutation.type !== "profile:upsert") {
        return;
      }

      const incoming = toCamelKeys(mutation.row) as ProfileRecord;

      if (incoming.ownerUserId !== userId) {
        return;
      }

      const slot = incoming.type === "Human" ? "human" : "agent";

      setPair((current) => {
        if (current[slot].id !== incoming.id) {
          return current;
        }

        return {
          ...current,
          [slot]: {
            ...current[slot],
            ...incoming,
          },
        };
      });
    },
    topic: `profiles:user:${userId}`,
  });

  const handleCreateKey = async (profile: ManagedProfileRecord) => {
    setCreatingKeyProfileId(profile.id);
    setError(null);

    try {
      const created = await createProfileKey(sdk, profile);
      const slot = profile.type === "Human" ? "human" : "agent";

      setPair((current) => ({
        ...current,
        [slot]: {
          ...current[slot],
          keys: upsertProfileKey(current[slot].keys, created.key),
        },
      }));
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

  const handleRevokeKey = (
    profile: ManagedProfileRecord,
    key: ProfileKeyRecord,
  ) => {
    setConfirmState({
      confirmLabel: "Revoke key",
      message: `Revoke ${key.preview}? Existing CLI sessions will fail.`,
      onConfirm: () => {
        void performRevokeKey(profile, key);
      },
      title: "Revoke API key",
    });
  };

  const performRevokeKey = async (
    profile: ManagedProfileRecord,
    key: ProfileKeyRecord,
  ) => {
    setRevokingKeyId(key.id);
    setError(null);

    try {
      const revoked = await revokeProfileKey(sdk, key.id);
      const slot = profile.type === "Human" ? "human" : "agent";

      setPair((current) => ({
        ...current,
        [slot]: {
          ...current[slot],
          keys: current[slot].keys.map((entry) =>
            entry.id === key.id
              ? {
                  ...entry,
                  deletedAt: revoked.revokedAt,
                }
              : entry,
          ),
        },
      }));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setRevokingKeyId(null);
    }
  };

  return (
    <div
      className="space-y-4 pb-12"
      {...getChangeTargetProps(changeTargetKey.profiles())}
    >
      {error ? <MarbleAlert tone="error">{error}</MarbleAlert> : null}

      {lastCreatedKey ? (
        <NewKeyModal
          onClose={() => setLastCreatedKey(null)}
          profileName={lastCreatedKey.profileName}
          token={lastCreatedKey.token}
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <ProfileCard
          mintLabel="Add key"
          mintVariant="orange"
          onCreateKey={() => void handleCreateKey(pair.agent)}
          onRevokeKey={(key) => handleRevokeKey(pair.agent, key)}
          pendingKeyCreation={creatingKeyProfileId === pair.agent.id}
          profile={pair.agent}
          revokingKeyId={revokingKeyId}
          tone="orange"
        />

        <ProfileCard
          mintLabel="Add key"
          mintVariant="dark"
          onCreateKey={() => void handleCreateKey(pair.human)}
          onRevokeKey={(key) => handleRevokeKey(pair.human, key)}
          pendingKeyCreation={creatingKeyProfileId === pair.human.id}
          profile={pair.human}
          revokingKeyId={revokingKeyId}
          tone="default"
        />
      </div>

      {confirmState ? (
        <MarbleConfirmModal
          onClose={() => setConfirmState(null)}
          state={confirmState}
        />
      ) : null}
    </div>
  );
}
