"use client";

import type { Database } from "@marble/supabase";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type EventRow = Database["public"]["Tables"]["event"]["Row"];
type ProfileRow = Pick<
  Database["public"]["Tables"]["profile"]["Row"],
  "created_at" | "external_name" | "id" | "name" | "type"
>;
type EventOperation = EventRow["operation"];
type EventSource = EventRow["source"];
type RealtimePayload<Row> = {
  eventType: "DELETE" | "INSERT" | "UPDATE";
  new: Partial<Row>;
  old: Partial<Row>;
};
type EventDiffEntry = {
  path: string[];
};

const COUNT_FORMATTER = new Intl.NumberFormat("en-GB");
const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});
const ABSOLUTE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});
const OPERATION_ORDER: EventOperation[] = [
  "Create",
  "Update",
  "Delete",
  "Read",
];
const OPERATION_CHIPS: Record<EventOperation, string> = {
  Create: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Delete: "border-rose-200 bg-rose-50 text-rose-700",
  Read: "border-sky-200 bg-sky-50 text-sky-700",
  Update: "border-amber-200 bg-amber-50 text-amber-700",
};
const RESOURCE_CHIPS: Record<string, string> = {
  cell: "border-cyan-200 bg-cyan-50 text-cyan-700",
  column: "border-orange-200 bg-orange-50 text-orange-700",
  key: "border-lime-200 bg-lime-50 text-lime-700",
  profile: "border-teal-200 bg-teal-50 text-teal-700",
  program: "border-indigo-200 bg-indigo-50 text-indigo-700",
  row: "border-amber-200 bg-amber-50 text-amber-700",
  secret: "border-violet-200 bg-violet-50 text-violet-700",
  table: "border-pink-200 bg-pink-50 text-pink-700",
};
const SOURCE_CHIPS: Record<EventSource, string> = {
  CLI: "border-violet-200 bg-violet-50 text-violet-700",
  RAW_API: "border-sky-200 bg-sky-50 text-sky-700",
  WEB_APP: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
};
const SOURCE_LABELS: Record<EventSource, string> = {
  CLI: "CLI",
  RAW_API: "Raw API",
  WEB_APP: "Web app",
};
const SUMMARY_CHIPS = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  fuchsia: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
  zinc: "border-zinc-200 bg-white text-zinc-700",
} as const;

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

  return diff.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    return [
      {
        path: Array.isArray(entry.path)
          ? entry.path.filter(
              (segment): segment is string => typeof segment === "string",
            )
          : [],
      },
    ];
  });
}

function getSnapshot(event: EventRow) {
  return isRecord(event.after_state)
    ? event.after_state
    : isRecord(event.before_state)
      ? event.before_state
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

  return `${titleCase(event.resource)} ${shortId(event.entity_id)}`;
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

function upsertEvent(current: EventRow[], nextEvent: EventRow, limit: number) {
  return [
    nextEvent,
    ...current.filter((event) => event.id !== nextEvent.id),
  ]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, limit);
}

export function EventFeedBoard({
  initialEvents,
  limit,
  profiles,
}: {
  initialEvents: EventRow[];
  limit: number;
  profiles: ProfileRow[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState(initialEvents);
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const entryTimeouts = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const [liveInsertCount, setLiveInsertCount] = useState(0);
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
  const ownedProfileIdsKey = useMemo(
    () => ownedProfileIds.join(","),
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
    if (ownedProfileIds.length === 0) {
      return;
    }

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

    const handleRealtimePayload = (payload: RealtimePayload<EventRow>) => {
      const candidate =
        payload.eventType === "DELETE" ? payload.old : payload.new;
      const eventId = candidate.id;
      const actorProfileId = candidate.actor_profile_id;

      if (typeof eventId !== "string") {
        return;
      }

      if (
        payload.eventType !== "DELETE" &&
        (typeof actorProfileId !== "string" ||
          !ownedProfileIdSet.has(actorProfileId))
      ) {
        return;
      }

      startTransition(() => {
        setEvents((current) => {
          if (payload.eventType === "DELETE") {
            return current.filter((event) => event.id !== eventId);
          }

          return upsertEvent(current, payload.new as EventRow, limit);
        });

        if (payload.eventType === "INSERT") {
          setLiveInsertCount((current) => current + 1);
        }
      });

      if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
        markEntering(eventId);
      }
    };

    const channel = supabase
      .channel(`events:owned-feed:${ownedProfileIdsKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event",
        },
        (payload) => {
          handleRealtimePayload(
            payload as unknown as RealtimePayload<EventRow>,
          );
        },
      )
      .subscribe();

    return () => {
      for (const timeout of entryTimeouts.current.values()) {
        clearTimeout(timeout);
      }
      entryTimeouts.current.clear();
      void supabase.removeChannel(channel);
    };
  }, [
    limit,
    ownedProfileIds.length,
    ownedProfileIdsKey,
    ownedProfileIdSet,
    supabase,
  ]);

  const analytics = useMemo(() => {
    const operationCounts: Record<EventOperation, number> = {
      Create: 0,
      Delete: 0,
      Read: 0,
      Update: 0,
    };
    const sourceCounts = new Map<EventSource, number>([
      [
        "WEB_APP",
        0,
      ],
      [
        "RAW_API",
        0,
      ],
      [
        "CLI",
        0,
      ],
    ]);
    const resourceCounts = new Map<string, number>();
    const activeProfileIds = new Set<string>();
    const requestIds = new Set<string>();
    let diffCount = 0;

    for (const event of events) {
      operationCounts[event.operation] += 1;
      sourceCounts.set(event.source, (sourceCounts.get(event.source) ?? 0) + 1);
      resourceCounts.set(
        event.resource,
        (resourceCounts.get(event.resource) ?? 0) + 1,
      );
      activeProfileIds.add(event.actor_profile_id);

      if (event.request_id) {
        requestIds.add(event.request_id);
      }

      diffCount += parseDiffEntries(event.diff).length;
    }

    const topResource =
      [
        ...resourceCounts.entries(),
      ].sort((left, right) => right[1] - left[1])[0] ?? null;

    return {
      activeProfileCount: activeProfileIds.size,
      diffCount,
      operationCounts,
      requestCount: requestIds.size,
      sourceCounts,
      topResource,
    };
  }, [
    events,
  ]);

  const summaryChips = [
    {
      label: "Loaded",
      tone: SUMMARY_CHIPS.zinc,
      value: COUNT_FORMATTER.format(events.length),
    },
    {
      label: "Profiles",
      tone: SUMMARY_CHIPS.sky,
      value: `${analytics.activeProfileCount}/${profiles.length}`,
    },
    {
      label: "Requests",
      tone: SUMMARY_CHIPS.violet,
      value: COUNT_FORMATTER.format(analytics.requestCount),
    },
    {
      label: "Changed fields",
      tone: SUMMARY_CHIPS.amber,
      value: COUNT_FORMATTER.format(analytics.diffCount),
    },
    {
      label: "Top",
      tone: SUMMARY_CHIPS.emerald,
      value: analytics.topResource
        ? `${titleCase(analytics.topResource[0])} · ${COUNT_FORMATTER.format(
            analytics.topResource[1],
          )}`
        : "No data",
    },
    {
      label: "Live",
      tone: SUMMARY_CHIPS.fuchsia,
      value: `+${COUNT_FORMATTER.format(liveInsertCount)}`,
    },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Events
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Latest activity across every profile owned by the signed-in user.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {summaryChips.map((chip) => (
            <span
              key={chip.label}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${chip.tone}`}
            >
              <span className="text-zinc-500">{chip.label}</span>
              <span className="font-mono text-[12px] text-current">
                {chip.value}
              </span>
            </span>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live feed
              </span>
              {OPERATION_ORDER.map((operation) => (
                <span
                  key={operation}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${OPERATION_CHIPS[operation]}`}
                >
                  {operation}
                  <span className="font-mono text-[11px]">
                    {COUNT_FORMATTER.format(
                      analytics.operationCounts[operation],
                    )}
                  </span>
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  "WEB_APP",
                  "RAW_API",
                  "CLI",
                ] as EventSource[]
              ).map((source) => (
                <span
                  key={source}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${SOURCE_CHIPS[source]}`}
                >
                  {SOURCE_LABELS[source]}
                  <span className="font-mono text-[11px]">
                    {COUNT_FORMATTER.format(
                      analytics.sourceCounts.get(source) ?? 0,
                    )}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="max-w-md space-y-2">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                No events yet
              </h3>
              <p className="text-sm leading-6 text-zinc-500">
                Create or mutate tables, profiles, keys, secrets, or programs
                through one of your profiles and the feed will begin filling in
                here.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                href="/tables"
              >
                Go to tables
              </Link>
              <Link
                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                href="/profiles"
              >
                Manage profiles
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-h-[72vh] overflow-auto">
            <div className="min-w-[1080px]">
              <div className="sticky top-0 z-10 grid grid-cols-[140px_180px_minmax(280px,1.5fr)_170px_120px_140px] gap-3 border-b border-zinc-200 bg-white/95 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-zinc-500 backdrop-blur sm:px-5">
                <div>Time</div>
                <div>Mutation</div>
                <div>Resource</div>
                <div>Actor</div>
                <div>Source</div>
                <div>Request</div>
              </div>

              <div className="divide-y divide-zinc-100">
                {events.map((event) => {
                  const diffEntries = parseDiffEntries(event.diff);
                  const diffEntryCount = diffEntries.length;
                  const diffSummary = describeDiff(event, diffEntries);
                  const profile = profileById.get(event.actor_profile_id);
                  const isEntering = enteringIdSet.has(event.id);

                  return (
                    <div
                      key={event.id}
                      className="event-feed-row grid grid-cols-[140px_180px_minmax(280px,1.5fr)_170px_120px_140px] gap-3 px-4 py-3 sm:px-5"
                      data-entering={isEntering ? "true" : undefined}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900">
                          {formatRelativeTime(event.created_at)}
                        </p>
                        <time
                          className="mt-1 block font-mono text-[11px] text-zinc-500"
                          dateTime={event.created_at}
                          title={event.created_at}
                        >
                          {formatAbsoluteTime(event.created_at)}
                        </time>
                      </div>

                      <div className="min-w-0">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${OPERATION_CHIPS[event.operation]}`}
                        >
                          {event.operation}
                        </span>
                        <p className="mt-2 truncate text-xs text-zinc-500">
                          {diffSummary}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                              RESOURCE_CHIPS[event.resource] ??
                              "border-zinc-200 bg-zinc-50 text-zinc-700"
                            }`}
                          >
                            {titleCase(event.resource)}
                          </span>
                          <p className="truncate text-sm font-medium text-zinc-900">
                            {describeEntity(event)}
                          </p>
                        </div>
                        <p className="mt-2 font-mono text-[11px] text-zinc-400">
                          {event.entity_id}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {profile?.name || shortId(event.actor_profile_id)}
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {profile?.external_name ||
                            profile?.type ||
                            "Owned profile"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${SOURCE_CHIPS[event.source]}`}
                        >
                          {SOURCE_LABELS[event.source]}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="font-mono text-xs text-zinc-700">
                          {event.request_id
                            ? shortId(event.request_id)
                            : "system"}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          {diffEntryCount} diff point
                          {diffEntryCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
