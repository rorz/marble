"use client";

import {
  MarbleBadge,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleEmptyState,
  MarbleJsonPreview,
  MarbleStat,
} from "@marble/ui";
import {
  describeDiff,
  describeEntity,
  type EventDiffEntry,
  type EventRow,
  formatAbsoluteTime,
  formatRelativeTime,
  OPERATION_BADGE_TONES,
  type ProfileRow,
  RESOURCE_BADGE_TONES,
  SOURCE_BADGE_TONES,
  SOURCE_LABELS,
  titleCase,
} from "./transforms";

const EventDetailField = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => {
  return (
    <MarbleStat
      label={label}
      tone="subtle"
      value={<span className="break-all">{value}</span>}
    />
  );
};

const EventSnapshot = ({ title, value }: { title: string; value: unknown }) => {
  return (
    <div className="overflow-hidden rounded-xs border border-taupe-200 bg-zinc-50">
      <div className="border-taupe-200 border-b px-3 py-2 text-eyebrow-xs text-zinc-500">
        {title}
      </div>
      <MarbleJsonPreview
        borderClassName="border-0"
        className="max-h-72 rounded-none"
        size="sm"
        value={value}
      />
    </div>
  );
};

export const EventFeedDetail = ({
  diffEntries,
  profileById,
  selectedEvent,
}: {
  diffEntries: EventDiffEntry[];
  profileById: Map<string, ProfileRow>;
  selectedEvent: EventRow | undefined;
}) => {
  return (
    <MarbleCard className="flex min-h-[24rem] w-full flex-col xl:w-[24rem] xl:max-w-[24rem]">
      {selectedEvent ? (
        <>
          <MarbleCardHeader className="gap-4 border-taupe-200 border-b">
            <div className="flex flex-wrap gap-2">
              <MarbleBadge
                tone={OPERATION_BADGE_TONES[selectedEvent.operation]}
              >
                {selectedEvent.operation}
              </MarbleBadge>
              <MarbleBadge
                tone={RESOURCE_BADGE_TONES[selectedEvent.resource] ?? "neutral"}
              >
                {titleCase(selectedEvent.resource)}
              </MarbleBadge>
              <MarbleBadge tone={SOURCE_BADGE_TONES[selectedEvent.source]}>
                {SOURCE_LABELS[selectedEvent.source]}
              </MarbleBadge>
            </div>

            <div className="space-y-1">
              <MarbleCardTitle className="text-base">
                {describeEntity(selectedEvent)}
              </MarbleCardTitle>
              <MarbleCardDescription>
                {formatAbsoluteTime(selectedEvent.createdAt)} ·{" "}
                {formatRelativeTime(selectedEvent.createdAt)}
              </MarbleCardDescription>
            </div>
          </MarbleCardHeader>

          <MarbleCardContent className="space-y-5 overflow-y-auto pt-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <EventDetailField
                label="Profile"
                value={
                  profileById.get(selectedEvent.actorProfileId)?.name ||
                  selectedEvent.actorProfileId
                }
              />
              <EventDetailField
                label="Request"
                value={selectedEvent.requestId || "system"}
              />
              <EventDetailField
                label="Entity"
                value={selectedEvent.entityId}
              />
              <EventDetailField
                label="Summary"
                value={describeDiff(selectedEvent, diffEntries)}
              />
            </div>

            <MarbleStat
              label="Changed paths"
              tone="subtle"
              value={
                diffEntries.length === 0 ? (
                  <span className="text-zinc-500">No diff entries.</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {diffEntries.map((entry) => (
                      <MarbleBadge
                        key={`${selectedEvent.id}-${entry.key}`}
                        tone="neutral"
                      >
                        {entry.path.join(".") || "(root)"}
                      </MarbleBadge>
                    ))}
                  </div>
                )
              }
            />

            <div className="space-y-3">
              <EventSnapshot
                title="Before"
                value={selectedEvent.beforeState}
              />
              <EventSnapshot
                title="After"
                value={selectedEvent.afterState}
              />
            </div>
          </MarbleCardContent>
        </>
      ) : (
        <MarbleCardContent className="flex flex-1 items-center justify-center">
          <MarbleEmptyState
            description="Select an event from the feed to inspect its payload and diff summary."
            title="Event detail"
          />
        </MarbleCardContent>
      )}
    </MarbleCard>
  );
};
