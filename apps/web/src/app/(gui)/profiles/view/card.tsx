"use client";

import {
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleListRow,
} from "@marble/ui";
import { RobotIcon, UserIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import type {
  ManagedProfileRecord,
  ProfileKeyRecord,
  ProfileRecord,
} from "../shared";

const CREATED_AT_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});
const VISIBLE_KEY_COUNT = 3;

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

export function ProfileCard({
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
