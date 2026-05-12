import type { MarbleClient } from "@marble/sdk";
import type { MarbleBadgeProps } from "@marble/ui";

export type EventRow = Awaited<
  ReturnType<MarbleClient["events"]["listForCurrentUser"]>
>[number];
export type ProfileRow = Awaited<
  ReturnType<MarbleClient["profiles"]["list"]>
>[number];
export type EventOperation = EventRow["operation"];
type EventSource = EventRow["source"];
type MarbleBadgeTone = NonNullable<MarbleBadgeProps["tone"]>;
export type EventDiffEntry = {
  key: string;
  path: string[];
};
export type RealtimeStatus = "connecting" | "error" | "live";

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
export const OPERATION_BADGE_TONES: Record<EventOperation, MarbleBadgeTone> = {
  Create: "success",
  Delete: "error",
  Read: "info",
  Update: "warning",
};
export const RESOURCE_BADGE_TONES: Record<string, MarbleBadgeTone> = {
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
export const SOURCE_BADGE_TONES: Record<EventSource, MarbleBadgeTone> = {
  CLI: "neutral",
  RAW_API: "info",
  WEB_APP: "solid",
};
export const SOURCE_LABELS: Record<EventSource, string> = {
  CLI: "CLI",
  RAW_API: "Raw API",
  WEB_APP: "Web app",
};
export const REALTIME_STATUS_LABELS: Record<RealtimeStatus, string> = {
  connecting: "Connecting",
  error: "Offline",
  live: "Live",
};
export const REALTIME_STATUS_TONES: Record<RealtimeStatus, MarbleBadgeTone> = {
  connecting: "warning",
  error: "error",
  live: "success",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function shortId(value: string) {
  return value.slice(0, 8);
}

export function titleCase(value: string) {
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

export function formatRelativeTime(value: string) {
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

export function formatAbsoluteTime(value: string) {
  return ABSOLUTE_TIME_FORMATTER.format(new Date(value));
}

export function parseDiffEntries(diff: unknown): EventDiffEntry[] {
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

export function describeEntity(event: EventRow) {
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

export function describeDiff(
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

export function describeRequest(event: EventRow) {
  return event.requestId ? shortId(event.requestId) : "system";
}

export function formatStatValue(value: number) {
  return COUNT_FORMATTER.format(value);
}

export function upsertEvent(
  current: EventRow[],
  nextEvent: EventRow,
  limit: number,
) {
  return [
    nextEvent,
    ...current.filter((event) => event.id !== nextEvent.id),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}
