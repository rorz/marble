import type { Json } from "@marble/supabase";
import type { CaptureKind, LaneConfig, TimingKind } from "./types";

export const lanes = [
  {
    captureKind: "postgres",
    createKind: "sdk",
    id: "sdk-postgres",
    label: "SDK create / Postgres event",
  },
  {
    captureKind: "broadcast",
    createKind: "sdk",
    id: "sdk-broadcast",
    label: "SDK create / Broadcast",
  },
  {
    captureKind: "postgres",
    createKind: "supabase",
    id: "supabase-postgres",
    label: "Supabase create / Postgres event",
  },
  {
    captureKind: "broadcast",
    createKind: "supabase",
    id: "supabase-broadcast",
    label: "Supabase create / Broadcast",
  },
] as const satisfies LaneConfig[];

export const sourcePayloadSchema = {
  additionalProperties: true,
  properties: {
    laneId: {
      type: "string",
    },
    message: {
      type: "string",
    },
    perfRunId: {
      type: "string",
    },
    sentAt: {
      format: "date-time",
      type: "string",
    },
  },
  required: [
    "laneId",
    "message",
    "perfRunId",
    "sentAt",
  ],
  type: "object",
} as const satisfies Json;

export const laneStyles = {
  broadcast: {
    dotClassName: "bg-emerald-500",
    textClassName: "text-emerald-700",
  },
  postgres: {
    dotClassName: "bg-sky-500",
    textClassName: "text-sky-700",
  },
} satisfies Record<
  CaptureKind,
  {
    dotClassName: string;
    textClassName: string;
  }
>;

export const timingKindOrder = {
  request: 0,
  setup: 2,
  wall: 1,
} satisfies Record<TimingKind, number>;
