import type { Database, Json } from "@marble/supabase";
import type { createClient } from "@/lib/supabase/browser";

export type BrowserSupabaseClient = ReturnType<typeof createClient>;
export type SourceEventRow =
  Database["public"]["Tables"]["source_event"]["Row"];
type CreateKind = "sdk" | "supabase";
export type CaptureKind = "postgres" | "broadcast";
export type LaneStatus = "error" | "pending" | "ready" | "subscribing";
export type TimingKind = "request" | "setup" | "wall";
type TimingStatus = "error" | "ok";

export type SdkProject = {
  id: string;
};

export type SdkSource = {
  id: string;
  name: string;
  projectId: string;
};

export type SourceSnapshot = {
  id: string;
  name: string;
  projectId: string;
};

export type SourceEventSnapshot = {
  createdAt: string;
  id: string;
  projectId: string;
  rawPayload: Json;
  sourceId: string;
};

export type TimingEntry = {
  detail?: string;
  durationMs: number;
  elapsedMs: number;
  id: number;
  key: string;
  kind?: TimingKind;
  label: string;
  laneId: LaneId | "setup";
  runId?: string;
  status: TimingStatus;
};

export type LaneConfig = {
  captureKind: CaptureKind;
  createKind: CreateKind;
  id: LaneId;
  label: string;
};

export type LaneId =
  | "sdk-broadcast"
  | "sdk-postgres"
  | "supabase-broadcast"
  | "supabase-postgres";

export type LaneState = {
  error: string | null;
  latestEvent: SourceEventSnapshot | null;
  pending: boolean;
  ready: boolean;
  run: (value: string, startedAt?: number) => Promise<void>;
  status: LaneStatus;
  timings: TimingEntry[];
};

export type ObservationResult = {
  event: SourceEventSnapshot;
  observedAt: number;
  startedAt: number;
};

export type PendingObservation = {
  reject: (cause: Error) => void;
  resolve: (observation: ObservationResult) => void;
  runId: string;
  startedAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
};

export type BroadcastObserver = (event: SourceEventSnapshot) => void;

export type BroadcastSubscription = {
  addObserver: (observer: BroadcastObserver) => () => void;
  error: string | null;
  status: LaneStatus;
};

export type BroadcastSourceEventPayload = {
  event: string;
  payload: {
    old_record: SourceEventRow | null;
    operation: "DELETE" | "INSERT" | "UPDATE";
    record: SourceEventRow | null;
    schema: string;
    table: string;
  };
  type: "broadcast";
};
