import { stringifyPretty } from "@marble/lib/json";
import type { Json } from "@marble/supabase";
import { timingKindOrder } from "./constants";
import type {
  LaneId,
  SdkSource,
  SourceEventRow,
  SourceEventSnapshot,
  SourceSnapshot,
  TimingEntry,
} from "./types";

export const nowMs = () => {
  return performance.now();
};

export const formatMs = (value: number) => {
  return `${Math.round(value)}ms`;
};

export const shortId = (value: string) => {
  return value.slice(0, 8);
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const getPayloadRunId = (value: Json) => {
  if (!isObject(value)) {
    return null;
  }

  return typeof value.perfRunId === "string" ? value.perfRunId : null;
};

export const formatJson = (value: Json) => {
  return stringifyPretty(value);
};

export const getLatestWallEntry = (entries: TimingEntry[]) => {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.kind === "wall") {
      return entries[index];
    }
  }

  return null;
};

export const orderTimingEntriesForDisplay = (entries: TimingEntry[]) => {
  return [
    ...entries,
  ].sort((left, right) => {
    if (left.runId && left.runId === right.runId) {
      const kindDelta =
        timingKindOrder[left.kind ?? "request"] -
        timingKindOrder[right.kind ?? "request"];

      if (kindDelta !== 0) {
        return kindDelta;
      }
    }

    return left.id - right.id;
  });
};

export const sourceToSnapshot = (source: SdkSource): SourceSnapshot => {
  return {
    id: source.id,
    name: source.name,
    projectId: source.projectId,
  };
};

export const dbEventToSnapshot = (
  event: SourceEventRow,
): SourceEventSnapshot => {
  return {
    createdAt: event.created_at,
    id: event.id,
    projectId: event.project_id,
    rawPayload: event.raw_payload,
    sourceId: event.source_id,
  };
};

export const requireSupabaseData = <T>(
  result: {
    data: T | null;
    error: {
      message: string;
    } | null;
  },
  missingMessage: string,
) => {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new Error(missingMessage);
  }

  return result.data;
};

export const createPayload = (input: {
  laneId: LaneId;
  runId: string;
  value: string;
}) => {
  return {
    laneId: input.laneId,
    message: input.value.trim() || "db-perf-2 source event",
    perfRunId: input.runId,
    sentAt: new Date().toISOString(),
  } satisfies Json;
};

export const sourceEventTopic = (sourceId: string) => {
  return `source-events:${sourceId}`;
};
