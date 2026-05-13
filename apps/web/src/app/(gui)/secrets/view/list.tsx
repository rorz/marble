"use client";

import {
  MarbleBadge,
  MarbleCard,
  MarbleCardContent,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleEmptyState,
  MarbleListRow,
} from "@marble/ui";
import { KeyIcon, PlusIcon } from "@phosphor-icons/react";
import type { SecretRecord } from "../actions";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

export const SecretList = ({
  creating,
  onCreate,
  onSelect,
  secrets,
  selectedSecretId,
}: {
  creating: boolean;
  onCreate: () => void;
  onSelect: (secretId: string) => void;
  secrets: SecretRecord[];
  selectedSecretId: string | null;
}) => {
  return (
    <MarbleCard className="min-h-[32rem]">
      <MarbleCardHeader
        actions={[
          {
            children: "New secret",
            iconLeft: PlusIcon,
            onClick: onCreate,
            variant: "light",
          },
        ]}
      >
        <MarbleCardTitle>Secrets in this project</MarbleCardTitle>
      </MarbleCardHeader>
      <MarbleCardContent className="min-h-0 px-0 pb-0">
        {secrets.length === 0 ? (
          <div className="px-5 pb-5">
            <MarbleEmptyState
              description="Create a named secret once, then point programs or columns at it."
              title="No secrets yet"
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-b-[inherit] border-t border-taupe-200">
            {secrets.map((secret) => (
              <MarbleListRow
                active={!creating && selectedSecretId === secret.id}
                align="start"
                description={
                  <div className="space-y-1">
                    <div className="text-[11px] text-zinc-400">
                      Updated{" "}
                      {DATE_TIME_FORMATTER.format(new Date(secret.updatedAt))}
                    </div>
                  </div>
                }
                icon={<KeyIcon size={16} />}
                iconTone="neutral"
                key={secret.id}
                meta={
                  <MarbleBadge
                    caps
                    tone={secret.category === "Managed" ? "warning" : "neutral"}
                  >
                    {secret.category === "Managed" ? "Managed" : "User"}
                  </MarbleBadge>
                }
                onClick={() => onSelect(secret.id)}
                title={secret.name}
                tone="orange"
              />
            ))}
          </div>
        )}
      </MarbleCardContent>
    </MarbleCard>
  );
};
