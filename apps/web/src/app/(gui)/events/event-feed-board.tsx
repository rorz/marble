"use client";

import { toCamelKeys } from "@marble/lib/object";
import type { MarbleClient } from "@marble/sdk";
import {
  cx,
  MarbleBadge,
  type MarbleBadgeProps,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleEmptyState,
  MarbleJsonPreview,
  MarbleListRow,
  MarbleStat,
} from "@marble/ui";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { isEventMutation } from "@/lib/realtime/event-mutations";
import { usePrivateBroadcast } from "@/lib/realtime/private-broadcast";

type EventRow = Awaited<
  ReturnType<MarbleClient["events"]["listForCurrentUser"]>
>[number];
type ProfileRow = Awaited<ReturnType<MarbleClient["profiles"]["list"]>>[number];
type EventOperation = EventRow["operation"];
type EventSource = EventRow["source"];
type MarbleBadgeTone = NonNullable<MarbleBadgeProps["tone"]>;
type EventDiffEntry = {
  key: string;
  path: string[];
};
type RealtimeStatus = "connecting" | "error" | "live";

const COUNT_FORMATTER = new Intl.NumberFormat("en-GB");
const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});
const ABSOLUTE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  second: "2-digit",
});
const OPERATION_BADGE_TONES: Record<EventOperation, MarbleBadgeTone> = {
  Create: "success",
  Delete: "error",
  Read: "info",
  Update: "warning",
};
const RESOURCE_BADGE_TONES: Record<string, MarbleBadgeTone> = {
  cell: "warning",
  column: "warning",
  key: "solid",
  profile: "success",
  program: "solid",
  project: "info",
  row: "warning",
  secret: "solid",
  table: "info",
};
const SOURCE_BADGE_TONES: Record<EventSource, MarbleBadgeTone> = {
  CLI: "neutral",
  RAW_API: "info",
  WEB_APP: "solid",
};
const SOURCE_LABELS: Record<EventSource, string> = {
  CLI: "CLI",
  RAW_API: "Raw API",
  WEB_APP: "Web app",
};
const REALTIME_STATUS_LABELS: Record<RealtimeStatus, string> = {
  connecting: "Connecting",
  error: "Offline",
  live: "Live",
};
const REALTIME_STATUS_TONES: Record<RealtimeStatus, MarbleBadgeTone> = {
  connecting: "warning",
  error: "error",
  live: "success",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function formatRelativeTime(value: string) {
  const diffMs = new Date(value).getTime() - Date.now();
  const absDiffMs = Math.abs(diffMs);

  if (absDiffMs < 10_000) {
    return "just now";
  }

  if (absDiffMs < 3_600_000) {
    return RELATIVE_TIME_FORMATTER.format(
      Math.round(diffMs / 60_000),
      "minute",
    );
  }

  if (absDiffMs < 86_400_000) {
    return RELATIVE_TIME_FORMATTER.format(
      Math.round(diffMs / 3_600_000),
      "hour",
    );
  }

  return RELATIVE_TIME_FORMATTER.format(Math.round(diffMs / 86_400_000), "day");
}

function formatAbsoluteTime(value: string) {
  return ABSOLUTE_TIME_FORMATTER.format(new Date(value));
}

function parseDiffEntries(diff: unknown): EventDiffEntry[] {
  if (!Array.isArray(diff)) {
    return [];
  }

  const pathOccurrences = new Map<string, number>();

  return diff.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const path = Array.isArray(entry.path)
      ? entry.path.filter(
          (segment): segment is string => typeof segment === "string",
        )
      : [];
    const pathKey = path.join(".") || "root";
    const occurrence = pathOccurrences.get(pathKey) ?? 0;

    pathOccurrences.set(pathKey, occurrence + 1);

    return [
      {
        key: occurrence === 0 ? pathKey : `${pathKey}-${occurrence + 1}`,
        path,
      },
    ];
  });
}

function getSnapshot(event: EventRow) {
  return isRecord(event.afterState)
    ? event.afterState
    : isRecord(event.beforeState)
      ? event.beforeState
      : null;
}

function getNamedValue(snapshot: Record<string, unknown> | null) {
  if (!snapshot) {
    return null;
  }

  const namedFields = [
    "name",
    "filename",
    "external_name",
    "prefix",
  ] as const;

  for (const field of namedFields) {
    const value = snapshot[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return field === "prefix" ? `key_${value}` : value;
    }
  }

  return null;
}

function getNumericValue(
  snapshot: Record<string, unknown> | null,
  key: string,
) {
  const candidate = snapshot?.[key];
  return typeof candidate === "number" ? candidate : null;
}

function describeEntity(event: EventRow) {
  const snapshot = getSnapshot(event);
  const namedValue = getNamedValue(snapshot);

  if (namedValue) {
    return namedValue;
  }

  const idx = getNumericValue(snapshot, "idx");
  if (idx !== null) {
    if (event.resource === "row") {
      return `Row #${idx + 1}`;
    }

    if (event.resource === "column") {
      return `Column #${idx + 1}`;
    }
  }

  const manualInput = snapshot?.manual_input;
  if (typeof manualInput === "string" && manualInput.trim().length > 0) {
    return truncate(manualInput, 52);
  }

  return `${titleCase(event.resource)} ${shortId(event.entityId)}`;
}

function describeDiff(
  event: EventRow,
  diffEntries = parseDiffEntries(event.diff),
) {
  const paths = diffEntries
    .map((entry) => entry.path.join("."))
    .filter((path) => path.length > 0);

  if (paths.length === 0) {
    if (event.operation === "Create") {
      return "created";
    }

    if (event.operation === "Delete") {
      return "deleted";
    }

    if (event.operation === "Read") {
      return "read";
    }

    return "updated";
  }

  const preview = paths.slice(0, 2).join(" • ");
  return `${COUNT_FORMATTER.format(paths.length)} field${
    paths.length === 1 ? "" : "s"
  }${preview ? ` · ${preview}` : ""}`;
}

function describeRequest(event: EventRow) {
  return event.requestId ? shortId(event.requestId) : "system";
}

function formatStatValue(value: number) {
  return COUNT_FORMATTER.format(value);
}

function upsertEvent(current: EventRow[], nextEvent: EventRow, limit: number) {
  return [
    nextEvent,
    ...current.filter((event) => event.id !== nextEvent.id),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

function EventDetailField({ label, value }: { label: string; value: string }) {
  return (
    <MarbleStat
      label={label}
      tone="subtle"
      value={<span className="break-all">{value}</span>}
    />
  );
}

function EventSnapshot({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="overflow-hidden rounded-xs border border-taupe-200 bg-zinc-50">
      <div className="border-taupe-200 border-b px-3 py-2 text-[10px] text-zinc-500 uppercase tracking-[0.18em]">
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
}

export function EventFeedBoard({
  initialEvents,
  limit,
  profiles,
  userId,
}: {
  initialEvents: EventRow[];
  limit: number;
  profiles: ProfileRow[];
  userId: string;
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [selectedEventId, setSelectedEventId] = useState<null | string>(
    initialEvents[0]?.id ?? null,
  );
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  const entryTimeouts = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const ownedProfileIds = useMemo(
    () => profiles.map((profile) => profile.id),
    [
      profiles,
    ],
  );
  const ownedProfileIdSet = useMemo(
    () => new Set(ownedProfileIds),
    [
      ownedProfileIds,
    ],
  );
  const enteringIdSet = useMemo(
    () => new Set(enteringIds),
    [
      enteringIds,
    ],
  );
  const profileById = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [
          profile.id,
          profile,
        ]),
      ),
    [
      profiles,
    ],
  );

  useEffect(() => {
    if (
      selectedEventId &&
      events.some((event) => event.id === selectedEventId)
    ) {
      return;
    }

    setSelectedEventId(events[0]?.id ?? null);
  }, [
    events,
    selectedEventId,
  ]);

  const markEntering = (eventId: string) => {
    startTransition(() => {
      setEnteringIds((current) =>
        current.includes(eventId)
          ? current
          : [
              eventId,
              ...current,
            ],
      );
    });

    const existingTimeout = entryTimeouts.current.get(eventId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      entryTimeouts.current.delete(eventId);
      startTransition(() => {
        setEnteringIds((current) =>
          current.filter((value) => value !== eventId),
        );
      });
    }, 320);

    entryTimeouts.current.set(eventId, timeout);
  };

  usePrivateBroadcast({
    enabled: ownedProfileIds.length > 0,
    event: "event_mutation",
    label: "Event feed",
    onError: () => setRealtimeStatus("error"),
    onMessage: (mutation) => {
      if (!isEventMutation(mutation)) {
        return;
      }

      const candidate =
        mutation.type === "event:upsert"
          ? (toCamelKeys(mutation.row) as EventRow)
          : null;
      const eventId =
        mutation.type === "event:delete" ? mutation.id : candidate?.id;
      const actorProfileId = candidate?.actorProfileId;

      if (
        typeof eventId !== "string" ||
        (mutation.type !== "event:delete" &&
          (typeof actorProfileId !== "string" ||
            !ownedProfileIdSet.has(actorProfileId)))
      ) {
        return;
      }

      startTransition(() => {
        setEvents((current) =>
          mutation.type === "event:delete"
            ? current.filter((event) => event.id !== eventId)
            : candidate
              ? upsertEvent(current, candidate, limit)
              : current,
        );
      });

      if (mutation.type === "event:upsert") {
        markEntering(eventId);
      }
    },
    onStatus: (status) => {
      if (status === "SUBSCRIBED") {
        setRealtimeStatus("live");
      }
    },
    topic: `events:user:${userId}`,
  });

  useEffect(
    () => () => {
      for (const timeout of entryTimeouts.current.values()) {
        clearTimeout(timeout);
      }
      entryTimeouts.current.clear();
    },
    [],
  );

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const selectedEventDiffEntries = selectedEvent
    ? parseDiffEntries(selectedEvent.diff)
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
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
                      onClick={() => setSelectedEventId(event.id)}
                      size="sm"
                      title={
                        <>
                          <MarbleBadge
                            caps
                            className="shrink-0"
                            tone={
                              RESOURCE_BADGE_TONES[event.resource] ?? "neutral"
                            }
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
                      wrapperClassName={cx(
                        isSelected ? "border-orange-100" : "",
                      )}
                    />
                  );
                })}
              </div>
            )}
          </MarbleCardContent>
        </MarbleCard>

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
                    tone={
                      RESOURCE_BADGE_TONES[selectedEvent.resource] ?? "neutral"
                    }
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
                    value={describeDiff(
                      selectedEvent,
                      selectedEventDiffEntries,
                    )}
                  />
                </div>

                <MarbleStat
                  label="Changed paths"
                  tone="subtle"
                  value={
                    selectedEventDiffEntries.length === 0 ? (
                      <span className="text-zinc-500">No diff entries.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedEventDiffEntries.map((entry) => (
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
      </div>
    </div>
  );
}
