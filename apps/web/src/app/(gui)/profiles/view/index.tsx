"use client";

import { toCamelKeys } from "@marble/lib/object";
import type { MarbleClient } from "@marble/sdk";
import {
  MarbleAlert,
  MarbleConfirmModal,
  type MarbleConfirmModalState,
} from "@marble/ui";
import { useState } from "react";
import { useMarbleWebSessionSdk } from "../../../../lib/marble-sdk-client";
import {
  createBroadcastMutationGuard,
  type DeleteMutation,
  type UpsertMutation,
} from "../../../../lib/realtime/broadcast-mutations";
import { usePrivateBroadcast } from "../../../../lib/realtime/private-broadcast";
import {
  compareByCreatedAtCamelDesc,
  getErrorMessage,
  sortRows,
  upsertRow,
} from "../../../../lib/realtime-crud";
import { changeTargetKey, getChangeTargetProps } from "../../change-spotlight";
import type {
  ManagedProfileRecord,
  ProfileKeyRecord,
  ProfileRecord,
} from "../shared";
import { ProfileCard } from "./card";
import { NewKeyModal } from "./new-key-modal";

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
