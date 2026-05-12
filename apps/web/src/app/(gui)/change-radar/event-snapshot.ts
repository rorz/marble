import type { MarbleClient } from "@marble/sdk";
import { CHANGE_RADAR_EVENT_LIMIT } from "./constants";

export type EventRow = Awaited<
  ReturnType<MarbleClient["events"]["listForCurrentUser"]>
>[number];
export type EventOperation = EventRow["operation"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

export function shortId(value: string) {
  return value.slice(0, 8);
}

export function pluralize(label: string, count: number) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

export function formatRadarRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const absDiffMs = Math.abs(diffMs);

  if (absDiffMs < 15_000) {
    return "now";
  }

  if (absDiffMs < 3_600_000) {
    return `${Math.round(absDiffMs / 60_000)}m`;
  }

  if (absDiffMs < 86_400_000) {
    return `${Math.round(absDiffMs / 3_600_000)}h`;
  }

  return `${Math.round(absDiffMs / 86_400_000)}d`;
}

export function getEventSnapshot(event: EventRow) {
  if (isRecord(event.afterState)) {
    return event.afterState;
  }

  if (isRecord(event.beforeState)) {
    return event.beforeState;
  }

  return null;
}

export function getStringField(
  snapshot: Record<string, unknown> | null,
  key: string,
) {
  const value = snapshot?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function upsertRadarEvent(current: EventRow[], nextEvent: EventRow) {
  return [
    nextEvent,
    ...current.filter((event) => event.id !== nextEvent.id),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, CHANGE_RADAR_EVENT_LIMIT);
}

export function formatUnreadCount(value: number) {
  return value > 99 ? "99+" : String(value);
}
