"use client";

import {
  MarbleCard,
  MarbleCardContent,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleEmptyState,
  MarbleListRow,
} from "@marble/ui";
import { KeyIcon, PlusIcon } from "@phosphor-icons/react";
import type { SecretRecord } from "../actions";
import { getSecretCategoryCopy } from "./category";

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
            {secrets.map((secret) => {
              const categoryCopy = getSecretCategoryCopy(secret.category);
              const updatedAt = DATE_TIME_FORMATTER.format(
                new Date(secret.updatedAt),
              );

              return (
                <MarbleListRow
                  active={!creating && selectedSecretId === secret.id}
                  align="start"
                  description={`${categoryCopy.rowDescription} - Updated ${updatedAt}`}
                  icon={<KeyIcon size={16} />}
                  iconTone="neutral"
                  key={secret.id}
                  onClick={() => onSelect(secret.id)}
                  title={secret.name}
                  tone="orange"
                />
              );
            })}
          </div>
        )}
      </MarbleCardContent>
    </MarbleCard>
  );
};
