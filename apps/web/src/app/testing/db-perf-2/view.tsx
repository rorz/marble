"use client";

import { MarbleClient } from "@marble/sdk";
import type { Database, Json } from "@marble/supabase";
import {
  cx,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleInput,
} from "@marble/ui";
import { PlayIcon, TrashIcon } from "@phosphor-icons/react/ssr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type BrowserSupabaseClient = ReturnType<typeof createClient>;
type SourceEventRow = Database["public"]["Tables"]["source_event"]["Row"];
type CreateKind = "sdk" | "supabase";
type CaptureKind = "postgres" | "broadcast";
type LaneStatus = "error" | "pending" | "ready" | "subscribing";
type TimingStatus = "error" | "ok";

type SdkProject = {
  id: string;
};

type SdkSource = {
  id: string;
  name: string;
  projectId: string;
};

type SourceSnapshot = {
  id: string;
  name: string;
  projectId: string;
};

type SourceEventSnapshot = {
  createdAt: string;
  id: string;
  projectId: string;
  rawPayload: Json;
  sourceId: string;
};

type TimingEntry = {
  detail?: string;
  durationMs: number;
  elapsedMs: number;
  id: number;
  label: string;
  laneId: LaneId | "setup";
  serverTiming?: ServerTimingTrace;
  status: TimingStatus;
};

type ServerTimingMetric = {
  durationMs: number | null;
  name: string;
};

type ServerTimingTrace = {
  metrics: ServerTimingMetric[];
  requestId?: string;
};

type LaneConfig = {
  captureKind: CaptureKind;
  createKind: CreateKind;
  id: LaneId;
  label: string;
};

type LaneId =
  | "sdk-broadcast"
  | "sdk-postgres"
  | "supabase-broadcast"
  | "supabase-postgres";

type LaneState = {
  error: string | null;
  latestEvent: SourceEventSnapshot | null;
  pending: boolean;
  ready: boolean;
  run: (value: string) => Promise<void>;
  status: LaneStatus;
  timings: TimingEntry[];
};

type PendingObservation = {
  reject: (cause: Error) => void;
  resolve: (event: SourceEventSnapshot) => void;
  runId: string;
  startedAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
};

type BroadcastObserver = (event: SourceEventSnapshot) => void;

type BroadcastSubscription = {
  addObserver: (observer: BroadcastObserver) => () => void;
  error: string | null;
  status: LaneStatus;
};

type BroadcastSourceEventPayload = {
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

const lanes = [
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

const sourcePayloadSchema = {
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

const laneStyles = {
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

function nowMs() {
  return performance.now();
}

function formatMs(value: number) {
  return `${Math.round(value)}ms`;
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPayloadRunId(value: Json) {
  if (!isObject(value)) {
    return null;
  }

  return typeof value.perfRunId === "string" ? value.perfRunId : null;
}

function formatJson(value: Json) {
  return JSON.stringify(value, null, 2);
}

function getErrorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

function parseServerTiming(value: string | null): ServerTimingMetric[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [rawName, ...parameters] = entry.split(";");
      const name = rawName?.trim();

      if (!name) {
        return [];
      }

      const durationParameter = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith("dur="));
      const rawDuration = durationParameter?.slice("dur=".length).trim();
      const durationMs =
        rawDuration === undefined ? Number.NaN : Number(rawDuration);

      return [
        {
          durationMs: Number.isFinite(durationMs) ? durationMs : null,
          name,
        },
      ];
    });
}

function responseServerTiming(response: Response) {
  const metrics = parseServerTiming(response.headers.get("Server-Timing"));
  const requestId = response.headers.get("x-marble-request-id")?.trim();

  if (metrics.length === 0 && !requestId) {
    return null;
  }

  return {
    metrics,
    requestId: requestId || undefined,
  } satisfies ServerTimingTrace;
}

function withDebugTimingHeader(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(
    input instanceof Request ? input.headers : init?.headers,
  );
  headers.set("x-marble-debug-timing", "1");

  if (input instanceof Request) {
    return [
      new Request(input, {
        headers,
      }),
      init,
    ] as const;
  }

  return [
    input,
    {
      ...init,
      headers,
    },
  ] as const;
}

function sourceToSnapshot(source: SdkSource): SourceSnapshot {
  return {
    id: source.id,
    name: source.name,
    projectId: source.projectId,
  };
}

function dbEventToSnapshot(event: SourceEventRow): SourceEventSnapshot {
  return {
    createdAt: event.created_at,
    id: event.id,
    projectId: event.project_id,
    rawPayload: event.raw_payload,
    sourceId: event.source_id,
  };
}

function requireSupabaseData<T>(
  result: {
    data: T | null;
    error: {
      message: string;
    } | null;
  },
  missingMessage: string,
) {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new Error(missingMessage);
  }

  return result.data;
}

function createPayload(input: {
  laneId: LaneId;
  runId: string;
  value: string;
}) {
  return {
    laneId: input.laneId,
    message: input.value.trim() || "db-perf-2 source event",
    perfRunId: input.runId,
    sentAt: new Date().toISOString(),
  } satisfies Json;
}

function sourceEventTopic(sourceId: string) {
  return `source-events:${sourceId}`;
}

function getApiUrl() {
  if (typeof window === "undefined") {
    return "http://localhost/api-v2";
  }

  return `${window.location.origin}/api-v2`;
}

export function DbPerf2View() {
  const supabase = useMemo(() => createClient(), []);
  const lastSetupServerTimingRef = useRef<ServerTimingTrace | null>(null);
  const pageStartedAtRef = useRef(nowMs());
  const timingIdRef = useRef(0);
  const [draftValue, setDraftValue] = useState("hello from db-perf-2");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<SourceSnapshot | null>(null);
  const [setupPending, setSetupPending] = useState(true);
  const [timings, setTimings] = useState<TimingEntry[]>([]);

  const appendTiming = useCallback(
    (entry: Omit<TimingEntry, "elapsedMs" | "id">) => {
      const currentTime = nowMs();
      timingIdRef.current += 1;

      setTimings((current) =>
        [
          ...current,
          {
            ...entry,
            elapsedMs: currentTime - pageStartedAtRef.current,
            id: timingIdRef.current,
          },
        ].slice(-64),
      );
    },
    [],
  );

  const setupFetch = useCallback<typeof fetch>(async (input, init) => {
    const [request, requestInit] = withDebugTimingHeader(input, init);
    const response = await fetch(request, {
      ...requestInit,
      cache: "no-store",
    });

    lastSetupServerTimingRef.current = responseServerTiming(response);
    return response;
  }, []);

  const sdk = useMemo(
    () =>
      new MarbleClient({
        apiUrl: getApiUrl(),
        fetch: setupFetch,
      }),
    [
      setupFetch,
    ],
  );

  const measureSetup = useCallback(
    async <T,>(label: string, task: () => Promise<T>) => {
      const startedAt = nowMs();
      lastSetupServerTimingRef.current = null;

      try {
        const result = await task();
        appendTiming({
          durationMs: nowMs() - startedAt,
          label,
          laneId: "setup",
          serverTiming: lastSetupServerTimingRef.current ?? undefined,
          status: "ok",
        });
        return result;
      } catch (cause) {
        appendTiming({
          detail: getErrorMessage(cause),
          durationMs: nowMs() - startedAt,
          label,
          laneId: "setup",
          status: "error",
        });
        throw cause;
      }
    },
    [
      appendTiming,
    ],
  );

  const setupSource = useCallback(async () => {
    setError(null);
    setSetupPending(true);

    try {
      const existingProject = await measureSetup(
        "setup projects.getMostRecentProject",
        () => sdk.projects.getMostRecentProject({}),
      );
      const project =
        existingProject ??
        (await measureSetup("setup projects.create", () =>
          sdk.projects.create({
            name: "DB perf 2",
          }),
        ));
      const nextSource = await measureSetup("setup sources.create", () =>
        sdk.sources.create({
          name: `DB perf 2 ${crypto.randomUUID().slice(0, 8)}`,
          payloadSchema: sourcePayloadSchema,
          projectId: (project as SdkProject).id,
        }),
      );

      setSource(sourceToSnapshot(nextSource));
    } catch (cause) {
      setError(getErrorMessage(cause));
      setSource(null);
    } finally {
      setSetupPending(false);
    }
  }, [
    measureSetup,
    sdk,
  ]);

  useEffect(() => {
    void setupSource();
  }, [
    setupSource,
  ]);

  const broadcastSubscription = useBroadcastSubscription({
    sourceId: source?.id ?? null,
    supabase,
  });
  const sdkPostgresLane = useCaptureLane({
    appendTiming,
    broadcastSubscription,
    lane: lanes[0],
    sourceId: source?.id ?? null,
    supabase,
  });
  const sdkBroadcastLane = useCaptureLane({
    appendTiming,
    broadcastSubscription,
    lane: lanes[1],
    sourceId: source?.id ?? null,
    supabase,
  });
  const supabasePostgresLane = useCaptureLane({
    appendTiming,
    broadcastSubscription,
    lane: lanes[2],
    sourceId: source?.id ?? null,
    supabase,
  });
  const supabaseBroadcastLane = useCaptureLane({
    appendTiming,
    broadcastSubscription,
    lane: lanes[3],
    sourceId: source?.id ?? null,
    supabase,
  });
  const laneStates = useMemo(
    () => [
      sdkPostgresLane,
      sdkBroadcastLane,
      supabasePostgresLane,
      supabaseBroadcastLane,
    ],
    [
      sdkBroadcastLane,
      sdkPostgresLane,
      supabaseBroadcastLane,
      supabasePostgresLane,
    ],
  );

  const runAllPending = setupPending || laneStates.some((lane) => lane.pending);
  const runAllDisabled =
    setupPending ||
    !source ||
    laneStates.some((lane) => !lane.ready || lane.pending);

  const runAll = useCallback(async () => {
    if (runAllDisabled) {
      return;
    }

    await Promise.all(laneStates.map((lane) => lane.run(draftValue)));
  }, [
    draftValue,
    laneStates,
    runAllDisabled,
  ]);

  const reset = useCallback(async () => {
    if (runAllPending) {
      return;
    }

    if (source) {
      try {
        await measureSetup("reset sources.delete", () =>
          sdk.sources.delete({
            id: source.id,
          }),
        );
      } catch (cause) {
        setError(getErrorMessage(cause));
      }
    }

    await setupSource();
  }, [
    measureSetup,
    runAllPending,
    sdk,
    setupSource,
    source,
  ]);

  return (
    <div className="flex min-h-full flex-col bg-taupe-50 p-4 text-taupe-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <MarbleCard>
          <MarbleCardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <MarbleBadge tone="info">db-perf-2</MarbleBadge>
              <div>
                <MarbleCardTitle>Source event realtime timings</MarbleCardTitle>
                <MarbleCardDescription>
                  SDK and Supabase creates, each observed through Postgres
                  changes and database broadcast.
                </MarbleCardDescription>
              </div>
              <p className="font-mono text-[11px] text-taupe-500">
                {source
                  ? `source ${shortId(source.id)} / project ${shortId(
                      source.projectId,
                    )}`
                  : "source pending"}
              </p>
            </div>
            <MarbleBadge
              tone={error ? "error" : runAllDisabled ? "warning" : "success"}
            >
              {error ? "Error" : runAllDisabled ? "Preparing" : "Ready"}
            </MarbleBadge>
          </MarbleCardHeader>
          <MarbleCardContent className="space-y-3">
            {error ? (
              <p
                className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
              <MarbleInput
                aria-label="Source event message"
                disabled={runAllPending}
                onChange={(event) => {
                  setDraftValue(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }

                  event.preventDefault();
                  void runAll();
                }}
                placeholder="Payload message"
                value={draftValue}
              />
              <MarbleButton
                disabled={runAllDisabled}
                iconLeft={PlayIcon}
                onClick={() => {
                  void runAll();
                }}
                type="button"
                variant="orange"
              >
                Run 2x2
              </MarbleButton>
              <MarbleButton
                disabled={runAllPending}
                iconLeft={TrashIcon}
                onClick={() => {
                  void reset();
                }}
                type="button"
              >
                Reset Source
              </MarbleButton>
            </div>
          </MarbleCardContent>
        </MarbleCard>

        <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
          {lanes.map((lane, index) => (
            <LanePanel
              key={lane.id}
              lane={lane}
              state={laneStates[index]}
            />
          ))}
        </div>

        <TimingPanel entries={timings} />
      </div>
    </div>
  );
}

function useBroadcastSubscription({
  sourceId,
  supabase,
}: Readonly<{
  sourceId: string | null;
  supabase: BrowserSupabaseClient;
}>): BroadcastSubscription {
  const observersRef = useRef(new Set<BroadcastObserver>());
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LaneStatus>("subscribing");

  const addObserver = useCallback((observer: BroadcastObserver) => {
    observersRef.current.add(observer);

    return () => {
      observersRef.current.delete(observer);
    };
  }, []);

  useEffect(() => {
    if (!sourceId) {
      setError(null);
      setStatus("subscribing");
      return;
    }

    let cancelled = false;
    let channel: ReturnType<BrowserSupabaseClient["channel"]> | null = null;

    const subscribe = async () => {
      setError(null);
      setStatus("subscribing");

      try {
        await supabase.realtime.setAuth();

        if (cancelled) {
          return;
        }

        channel = supabase
          .channel(sourceEventTopic(sourceId), {
            config: {
              private: true,
            },
          })
          .on(
            "broadcast",
            {
              event: "INSERT",
            },
            (payload) => {
              const change = payload as BroadcastSourceEventPayload;
              const record = change.payload.record;

              if (!record) {
                return;
              }

              const event = dbEventToSnapshot(record);

              for (const observer of observersRef.current) {
                observer(event);
              }
            },
          );

        channel.subscribe((nextStatus, subscribeError) => {
          if (cancelled) {
            return;
          }

          if (nextStatus === "SUBSCRIBED") {
            setError(null);
            setStatus("ready");
            return;
          }

          if (nextStatus === "CHANNEL_ERROR") {
            setError(subscribeError?.message ?? "Broadcast channel failed.");
            setStatus("error");
            return;
          }

          if (nextStatus === "CLOSED" || nextStatus === "TIMED_OUT") {
            setError(`Broadcast channel ${nextStatus.toLowerCase()}.`);
            setStatus("error");
          }
        });
      } catch (cause) {
        if (!cancelled) {
          setError(getErrorMessage(cause));
          setStatus("error");
        }
      }
    };

    void subscribe();

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [
    sourceId,
    supabase,
  ]);

  return useMemo(
    () => ({
      addObserver,
      error,
      status,
    }),
    [
      addObserver,
      error,
      status,
    ],
  );
}

function useCaptureLane({
  appendTiming,
  broadcastSubscription,
  lane,
  sourceId,
  supabase,
}: Readonly<{
  appendTiming: (entry: Omit<TimingEntry, "elapsedMs" | "id">) => void;
  broadcastSubscription: BroadcastSubscription;
  lane: LaneConfig;
  sourceId: string | null;
  supabase: BrowserSupabaseClient;
}>): LaneState {
  const lastServerTimingRef = useRef<ServerTimingTrace | null>(null);
  const pendingObservationRef = useRef<PendingObservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestEvent, setLatestEvent] = useState<SourceEventSnapshot | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<LaneStatus>("subscribing");
  const [timings, setTimings] = useState<TimingEntry[]>([]);
  const effectiveStatus =
    lane.captureKind === "broadcast" ? broadcastSubscription.status : status;
  const effectiveError =
    lane.captureKind === "broadcast" ? broadcastSubscription.error : error;

  const appendLaneTiming = useCallback(
    (entry: Omit<TimingEntry, "elapsedMs" | "id" | "laneId">) => {
      const nextEntry = {
        ...entry,
        laneId: lane.id,
      };

      appendTiming(nextEntry);
      setTimings((current) =>
        [
          ...current,
          {
            ...nextEntry,
            elapsedMs: nowMs(),
            id: current.length + 1,
          },
        ].slice(-8),
      );
    },
    [
      appendTiming,
      lane.id,
    ],
  );

  const sdkFetch = useCallback<typeof fetch>(async (input, init) => {
    const [request, requestInit] = withDebugTimingHeader(input, init);
    const response = await fetch(request, {
      ...requestInit,
      cache: "no-store",
    });

    lastServerTimingRef.current = responseServerTiming(response);
    return response;
  }, []);

  const sdk = useMemo(
    () =>
      new MarbleClient({
        apiUrl: getApiUrl(),
        fetch: sdkFetch,
      }),
    [
      sdkFetch,
    ],
  );

  const observeEvent = useCallback(
    (event: SourceEventSnapshot) => {
      const pendingObservation = pendingObservationRef.current;

      if (
        !pendingObservation ||
        getPayloadRunId(event.rawPayload) !== pendingObservation.runId
      ) {
        return;
      }

      clearTimeout(pendingObservation.timeoutId);
      pendingObservationRef.current = null;
      setLatestEvent(event);
      appendLaneTiming({
        durationMs: nowMs() - pendingObservation.startedAt,
        label: `${lane.captureKind} observed`,
        status: "ok",
      });
      pendingObservation.resolve(event);
    },
    [
      appendLaneTiming,
      lane.captureKind,
    ],
  );

  useEffect(() => {
    if (!sourceId) {
      setStatus("subscribing");
      setError(null);
      return;
    }

    if (lane.captureKind === "broadcast") {
      setError(null);
      return broadcastSubscription.addObserver(observeEvent);
    }

    let cancelled = false;
    let channel: ReturnType<BrowserSupabaseClient["channel"]> | null = null;

    const subscribe = async () => {
      setError(null);
      setStatus("subscribing");

      try {
        channel = supabase
          .channel(`db-perf-2:${lane.id}:${sourceId}`)
          .on<SourceEventRow>(
            "postgres_changes",
            {
              event: "INSERT",
              filter: `source_id=eq.${sourceId}`,
              schema: "public",
              table: "source_event",
            },
            (payload) => {
              observeEvent(dbEventToSnapshot(payload.new));
            },
          );

        channel.subscribe((nextStatus, subscribeError) => {
          if (cancelled) {
            return;
          }

          if (nextStatus === "SUBSCRIBED") {
            setStatus("ready");
            return;
          }

          if (nextStatus === "CHANNEL_ERROR") {
            setError(subscribeError?.message ?? "Realtime channel failed.");
            setStatus("error");
          }
        });
      } catch (cause) {
        if (!cancelled) {
          setError(getErrorMessage(cause));
          setStatus("error");
        }
      }
    };

    void subscribe();

    return () => {
      cancelled = true;

      if (pendingObservationRef.current) {
        clearTimeout(pendingObservationRef.current.timeoutId);
        pendingObservationRef.current = null;
      }

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [
    broadcastSubscription,
    lane.captureKind,
    lane.id,
    observeEvent,
    sourceId,
    supabase,
  ]);

  const measureCreate = useCallback(
    async <T,>(label: string, task: () => Promise<T>) => {
      const startedAt = nowMs();
      lastServerTimingRef.current = null;

      try {
        const result = await task();
        appendLaneTiming({
          durationMs: nowMs() - startedAt,
          label,
          serverTiming:
            lane.createKind === "sdk"
              ? (lastServerTimingRef.current ?? undefined)
              : undefined,
          status: "ok",
        });
        return result;
      } catch (cause) {
        appendLaneTiming({
          detail: getErrorMessage(cause),
          durationMs: nowMs() - startedAt,
          label,
          status: "error",
        });
        throw cause;
      }
    },
    [
      appendLaneTiming,
      lane.createKind,
    ],
  );

  const waitForObservation = useCallback((runId: string) => {
    const startedAt = nowMs();

    return new Promise<SourceEventSnapshot>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (pendingObservationRef.current?.runId === runId) {
          pendingObservationRef.current = null;
        }

        reject(new Error("Timed out waiting for realtime capture."));
      }, 8000);

      pendingObservationRef.current = {
        reject,
        resolve,
        runId,
        startedAt,
        timeoutId,
      };
    });
  }, []);

  const run = useCallback(
    async (value: string) => {
      if (!sourceId || effectiveStatus !== "ready" || pending) {
        return;
      }

      const runId = crypto.randomUUID();
      const payload = createPayload({
        laneId: lane.id,
        runId,
        value,
      });

      setError(null);
      setPending(true);

      const observation = waitForObservation(runId);

      try {
        if (lane.createKind === "sdk") {
          await measureCreate("sdk sourceEvents.create", () =>
            sdk.sourceEvents.create({
              rawPayload: payload,
              sourceId,
            }),
          );
        } else {
          await measureCreate("supabase source_event_create", async () =>
            requireSupabaseData(
              await supabase.rpc("source_event_create", {
                p_raw_payload: payload,
                p_source_id: sourceId,
              }),
              "No source event row was returned after insert.",
            ),
          );
        }

        await observation;
      } catch (cause) {
        if (pendingObservationRef.current?.runId === runId) {
          clearTimeout(pendingObservationRef.current.timeoutId);
          pendingObservationRef.current = null;
        }

        setError(getErrorMessage(cause));
        appendLaneTiming({
          detail: getErrorMessage(cause),
          durationMs: 0,
          label: `${lane.captureKind} failed`,
          status: "error",
        });
      } finally {
        setPending(false);
      }
    },
    [
      appendLaneTiming,
      lane.captureKind,
      lane.createKind,
      lane.id,
      measureCreate,
      pending,
      sdk,
      sourceId,
      effectiveStatus,
      supabase,
      waitForObservation,
    ],
  );

  return {
    error: effectiveError,
    latestEvent,
    pending,
    ready: effectiveStatus === "ready",
    run,
    status: pending ? "pending" : effectiveStatus,
    timings,
  };
}

function LanePanel({
  lane,
  state,
}: Readonly<{
  lane: LaneConfig;
  state: LaneState;
}>) {
  const styles = laneStyles[lane.captureKind];

  return (
    <MarbleCard className="min-h-[27rem]">
      <MarbleCardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <MarbleCardTitle className="text-sm">{lane.label}</MarbleCardTitle>
            <p
              className={cx(
                "flex items-center gap-1 font-medium text-[11px]",
                styles.textClassName,
              )}
            >
              <span
                className={cx("size-1.5 rounded-full", styles.dotClassName)}
              />
              {lane.createKind === "sdk" ? "new sdk" : "supabase js"} /{" "}
              {lane.captureKind}
            </p>
          </div>
          <MarbleBadge
            tone={state.error ? "error" : state.ready ? "success" : "warning"}
          >
            {state.error ? "Error" : state.status}
          </MarbleBadge>
        </div>
      </MarbleCardHeader>
      <MarbleCardContent className="space-y-4">
        {state.error ? (
          <p
            className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 border-t border-taupe-200 pt-4">
          <Metric
            label="Last event"
            value={state.latestEvent ? shortId(state.latestEvent.id) : "none"}
          />
          <Metric
            label="Timings"
            value={String(state.timings.length)}
          />
        </div>

        <div className="space-y-2">
          <div className="font-medium text-[10px] text-taupe-500 uppercase tracking-[0.18em]">
            Payload
          </div>
          <pre className="min-h-32 overflow-auto rounded-sm border border-taupe-200 bg-white p-3 font-mono text-[11px] text-taupe-800 leading-5">
            {state.latestEvent
              ? formatJson(state.latestEvent.rawPayload)
              : "No event captured yet."}
          </pre>
        </div>

        <TimingList entries={state.timings} />
      </MarbleCardContent>
    </MarbleCard>
  );
}

function Metric({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="min-w-0">
      <div className="font-medium text-[10px] text-taupe-500 uppercase tracking-[0.18em]">
        {label}
      </div>
      <div className="truncate font-mono text-sm text-taupe-950">{value}</div>
    </div>
  );
}

const serverTimingLabels = {
  api: "forward api",
  api_context: "api context",
  auth: "auth",
  db_rpc_source_event_create: "db rpc",
  openapi_handle: "openapi",
  orpc_handle: "orpc",
  profile: "profile",
  session: "session",
  store_source_events_create: "store create",
  total: "forward total",
  user: "user",
} satisfies Record<string, string>;

function serverTimingLabel(name: string) {
  return serverTimingLabels[name as keyof typeof serverTimingLabels] ?? name;
}

function shortRequestId(value: string) {
  return value.length <= 8 ? value : value.slice(0, 8);
}

function ServerTimingBreakdown({
  trace,
}: Readonly<{
  trace: ServerTimingTrace;
}>) {
  return (
    <div className="mt-1 border-taupe-200 border-l pl-2 text-taupe-500">
      {trace.requestId ? (
        <div className="mb-1 grid grid-cols-[minmax(0,1fr)_4.25rem] gap-2 text-[10px]">
          <span className="truncate">request</span>
          <span
            className="text-right tabular-nums text-taupe-600"
            title={trace.requestId}
          >
            {shortRequestId(trace.requestId)}
          </span>
        </div>
      ) : null}
      {trace.metrics.length > 0 ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_4.25rem] gap-x-2 gap-y-0.5 text-[10px]">
          {trace.metrics.map((metric) => (
            <div
              className="contents"
              key={`${metric.name}-${metric.durationMs ?? "none"}`}
            >
              <dt className="truncate">{serverTimingLabel(metric.name)}</dt>
              <dd className="text-right tabular-nums text-taupe-700">
                {metric.durationMs === null
                  ? "n/a"
                  : formatMs(metric.durationMs)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function TimingList({
  entries,
}: Readonly<{
  entries: TimingEntry[];
}>) {
  if (entries.length === 0) {
    return (
      <p className="border-t border-taupe-200 pt-3 text-sm text-taupe-500">
        No timings yet.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-taupe-200 border-t border-taupe-200 font-mono text-[11px]">
      {entries.map((entry) => (
        <li
          className="grid grid-cols-[minmax(0,1fr)_4.25rem] gap-2 py-2"
          key={`${entry.laneId}-${entry.id}-${entry.label}`}
        >
          <div className="min-w-0">
            <div
              className={cx(
                "truncate",
                entry.status === "error" ? "text-red-700" : "text-taupe-800",
              )}
            >
              {entry.label}
            </div>
            {entry.serverTiming ? (
              <ServerTimingBreakdown trace={entry.serverTiming} />
            ) : null}
            {entry.detail ? (
              <div className="break-words text-red-600">{entry.detail}</div>
            ) : null}
          </div>
          <div
            className={cx(
              "text-right tabular-nums",
              entry.status === "error" ? "text-red-700" : "text-taupe-950",
            )}
          >
            {formatMs(entry.durationMs)}
          </div>
        </li>
      ))}
    </ol>
  );
}

function TimingPanel({
  entries,
}: Readonly<{
  entries: TimingEntry[];
}>) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <MarbleCard>
      <MarbleCardHeader>
        <MarbleCardTitle>Combined timeline</MarbleCardTitle>
      </MarbleCardHeader>
      <MarbleCardContent>
        <ol className="space-y-1 font-mono text-[11px] text-taupe-600">
          {entries.map((entry) => (
            <li
              className="grid grid-cols-[4rem_9rem_minmax(0,1fr)_4.5rem] gap-2"
              key={`${entry.laneId}-${entry.id}`}
            >
              <span className="tabular-nums">+{formatMs(entry.elapsedMs)}</span>
              <span className="truncate font-medium">{entry.laneId}</span>
              <span
                className={cx(
                  "truncate",
                  entry.status === "error" ? "text-red-700" : "",
                )}
              >
                {entry.label}
              </span>
              <span className="text-right tabular-nums">
                {formatMs(entry.durationMs)}
              </span>
            </li>
          ))}
        </ol>
      </MarbleCardContent>
    </MarbleCard>
  );
}
