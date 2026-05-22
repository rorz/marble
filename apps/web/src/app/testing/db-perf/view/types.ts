import type { Database } from "@marble/supabase";
import type { createClient } from "@/lib/supabase/browser";

export type BrowserSupabaseClient = ReturnType<typeof createClient>;
export type TestingTag = Database["testing"]["Tables"]["tags"]["Row"];
export type ProbeKind = "broadcast" | "postgres";

export type TelemetryEntry = {
  durationMs?: number;
  elapsedMs: number;
  id: number;
  label: string;
};

export type PendingUpdate = {
  sequence: number;
  startedAt: number;
  value: string;
};

export type ProbeState = {
  commit: (value: string) => Promise<void>;
  dbValue: null | string;
  error: null | string;
  kind: ProbeKind;
  pending: boolean;
  ready: boolean;
  telemetry: TelemetryEntry[];
};

export type PostgresTagPayload =
  | {
      eventType: "DELETE";
      old: Partial<TestingTag>;
    }
  | {
      eventType: "INSERT" | "UPDATE";
      new: TestingTag;
    };

export type BroadcastTagPayload = {
  event: string;
  payload: {
    old_record: TestingTag | null;
    operation: "DELETE" | "INSERT" | "UPDATE";
    record: TestingTag | null;
    schema: string;
    table: string;
  };
  type: "broadcast";
};

export type MixedTelemetryEntry = TelemetryEntry & {
  key: string;
  kind: ProbeKind;
};
