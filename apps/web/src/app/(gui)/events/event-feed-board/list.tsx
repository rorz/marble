"use client";

import {
  cx,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleEmptyState,
  MarbleListRow,
  useMarbleRouter,
} from "@marble/ui";
import {
  describeDiff,
  describeEntity,
  describeRequest,
  type EventRow,
  formatRelativeTime,
  formatStatValue,
  OPERATION_BADGE_TONES,
  type ProfileRow,
  parseDiffEntries,
  REALTIME_STATUS_LABELS,
  REALTIME_STATUS_TONES,
  RESOURCE_BADGE_TONES,
  type RealtimeStatus,
  SOURCE_LABELS,
  shortId,
  titleCase,
} from "./transforms";

export const EventFeedList = ({
  enteringIdSet,
  events,
  limit,
  onSelect,
  profileById,
  profiles,
  realtimeStatus,
  selectedEventId,
}: {
  enteringIdSet: Set<string>;
  events: EventRow[];
  limit: number;
  onSelect: (eventId: string) => void;
  profileById: Map<string, ProfileRow>;
  profiles: ProfileRow[];
  realtimeStatus: RealtimeStatus;
  selectedEventId: null | string;
}) => {
  const router = useMarbleRouter();

  return (
    <MarbleCard className="flex min-h-[28rem] min-w-0 flex-1 flex-col">
      <MarbleCardHeader className="gap-3 border-taupe-200 border-b">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <MarbleCardTitle className="text-base">
              Owned activity feed
            </MarbleCardTitle>
            <MarbleCardDescription>
              Latest {formatStatValue(limit)} events from profiles you own.
            </MarbleCardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <MarbleBadge
              caps
              tone={REALTIME_STATUS_TONES[realtimeStatus]}
            >
              {REALTIME_STATUS_LABELS[realtimeStatus]}
            </MarbleBadge>
            <MarbleBadge
              caps
              tone="neutral"
            >
              {formatStatValue(events.length)} loaded
            </MarbleBadge>
          </div>
        </div>
      </MarbleCardHeader>

      <MarbleCardContent className="flex min-h-0 flex-1 flex-col px-0 pb-0">
        {events.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 py-12">
            <MarbleEmptyState
              actions={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <MarbleButton
                    onClick={() => router.push("/projects")}
                    size="sm"
                    variant="dark"
                  >
                    Open projects
                  </MarbleButton>
                  <MarbleButton
                    onClick={() => router.push("/profiles")}
                    size="sm"
                  >
                    Manage profiles
                  </MarbleButton>
                </div>
              }
              description={
                profiles.length === 0
                  ? "Create a profile first, then use it in Marble and the feed will begin filling in here."
                  : "Create or mutate projects, tables, profiles, secrets, keys, or programs through one of your profiles."
              }
              title={
                profiles.length === 0 ? "No profiles yet" : "No events yet"
              }
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {events.map((event) => {
              const diffEntries = parseDiffEntries(event.diff);
              const diffSummary = describeDiff(event, diffEntries);
              const isEntering = enteringIdSet.has(event.id);
              const isSelected = selectedEventId === event.id;
              const profile = profileById.get(event.actorProfileId);

              return (
                <MarbleListRow
                  active={isSelected}
                  align="center"
                  className={cx(
                    "transition-colors duration-300",
                    isEntering ? "bg-orange-50/70" : "",
                  )}
                  key={event.id}
                  meta={
                    <div className="flex items-center gap-2 text-right">
                      <MarbleBadge
                        tone={OPERATION_BADGE_TONES[event.operation]}
                      >
                        {event.operation}
                      </MarbleBadge>
                      <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                        {formatRelativeTime(event.createdAt)}
                      </span>
                    </div>
                  }
                  onClick={() => onSelect(event.id)}
                  size="sm"
                  title={
                    <>
                      <MarbleBadge
                        caps
                        className="shrink-0"
                        tone={RESOURCE_BADGE_TONES[event.resource] ?? "neutral"}
                      >
                        {titleCase(event.resource)}
                      </MarbleBadge>
                      <span className="min-w-0 shrink truncate text-zinc-950">
                        {describeEntity(event)}
                      </span>
                      <span className="shrink-0 text-zinc-300">/</span>
                      <span className="shrink-0 text-zinc-500">
                        {profile?.name || shortId(event.actorProfileId)}
                      </span>
                      <span className="shrink-0 text-zinc-300">/</span>
                      <span className="shrink-0 text-zinc-500">
                        {SOURCE_LABELS[event.source]}
                      </span>
                      <span className="shrink-0 text-zinc-300">/</span>
                      <span className="min-w-0 shrink truncate text-zinc-400">
                        {diffSummary}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-zinc-400">
                        {describeRequest(event)}
                      </span>
                    </>
                  }
                  titleClassName="flex min-w-0 items-center gap-2 overflow-hidden text-xs font-normal"
                  wrapperClassName={cx(isSelected ? "border-orange-100" : "")}
                />
              );
            })}
          </div>
        )}
      </MarbleCardContent>
    </MarbleCard>
  );
};
