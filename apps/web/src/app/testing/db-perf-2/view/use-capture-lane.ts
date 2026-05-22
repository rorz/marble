import { getErrorMessage } from "@marble/lib/result";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseMarbleClient } from "./client";
import {
  createPayload,
  dbEventToSnapshot,
  formatMs,
  getPayloadRunId,
  nowMs,
  requireSupabaseData,
} from "./timing";
import type {
  BroadcastSubscription,
  BrowserSupabaseClient,
  LaneConfig,
  LaneState,
  ObservationResult,
  PendingObservation,
  SourceEventRow,
  SourceEventSnapshot,
  TimingEntry,
} from "./types";

export const useCaptureLane = ({
  appendTiming,
  broadcastSubscription,
  lane,
  sourceId,
  supabase,
}: Readonly<{
  appendTiming: (entry: Omit<TimingEntry, "elapsedMs" | "id" | "key">) => void;
  broadcastSubscription: BroadcastSubscription;
  lane: LaneConfig;
  sourceId: string | null;
  supabase: BrowserSupabaseClient;
}>): LaneState => {
  const pendingObservationRef = useRef<PendingObservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestEvent, setLatestEvent] = useState<SourceEventSnapshot | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<LaneState["status"]>("subscribing");
  const [timings, setTimings] = useState<TimingEntry[]>([]);
  const effectiveStatus =
    lane.captureKind === "broadcast" ? broadcastSubscription.status : status;
  const effectiveError =
    lane.captureKind === "broadcast" ? broadcastSubscription.error : error;

  const appendLaneTiming = useCallback(
    (entry: Omit<TimingEntry, "elapsedMs" | "id" | "key" | "laneId">) => {
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
            key: crypto.randomUUID(),
          },
        ].slice(-8),
      );
    },
    [
      appendTiming,
      lane.id,
    ],
  );

  const sdk = useMemo(
    () => createSupabaseMarbleClient(supabase),
    [
      supabase,
    ],
  );

  const observeEvent = useCallback((event: SourceEventSnapshot) => {
    const pendingObservation = pendingObservationRef.current;

    if (
      !pendingObservation ||
      getPayloadRunId(event.rawPayload) !== pendingObservation.runId
    ) {
      return;
    }

    const observedAt = nowMs();

    clearTimeout(pendingObservation.timeoutId);
    pendingObservationRef.current = null;
    setLatestEvent(event);

    pendingObservation.resolve({
      event,
      observedAt,
      startedAt: pendingObservation.startedAt,
    });
  }, []);

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
    async <T>(label: string, runId: string, task: () => Promise<T>) => {
      const startedAt = nowMs();

      try {
        const result = await task();
        const durationMs = nowMs() - startedAt;

        appendLaneTiming({
          durationMs,
          kind: "request",
          label,
          runId,
          status: "ok",
        });
        return {
          durationMs,
          result,
        };
      } catch (cause) {
        const durationMs = nowMs() - startedAt;

        appendLaneTiming({
          detail: getErrorMessage(cause),
          durationMs,
          kind: "request",
          label,
          runId,
          status: "error",
        });
        throw cause;
      }
    },
    [
      appendLaneTiming,
    ],
  );

  const waitForObservation = useCallback((runId: string, startedAt: number) => {
    return new Promise<ObservationResult>((resolve, reject) => {
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
    async (value: string, startedAt = nowMs()) => {
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

      const runStartedAt = startedAt;
      const observation = waitForObservation(runId, runStartedAt);

      try {
        let requestDurationMs: number;

        if (lane.createKind === "sdk") {
          const createTiming = await measureCreate(
            "sdk sourceEvents.create",
            runId,
            () =>
              sdk.sourceEvents.create({
                rawPayload: payload,
                sourceId,
              }),
          );
          requestDurationMs = createTiming.durationMs;
        } else {
          const createTiming = await measureCreate(
            "supabase source_event_create",
            runId,
            async () =>
              requireSupabaseData(
                await supabase.rpc("source_event_create", {
                  p_raw_payload: payload,
                  p_source_id: sourceId,
                }),
                "No source event row was returned after insert.",
              ),
          );
          requestDurationMs = createTiming.durationMs;
        }

        const observed = await observation;
        const eventObservedMs = observed.observedAt - observed.startedAt;

        appendLaneTiming({
          detail: `request response ${formatMs(
            requestDurationMs,
          )} / update received ${formatMs(eventObservedMs)}`,
          durationMs: eventObservedMs,
          kind: "wall",
          label: `press-to-${lane.captureKind} update`,
          runId,
          status: "ok",
        });
      } catch (cause) {
        if (pendingObservationRef.current?.runId === runId) {
          clearTimeout(pendingObservationRef.current.timeoutId);
          pendingObservationRef.current = null;
        }

        setError(getErrorMessage(cause));
        appendLaneTiming({
          detail: getErrorMessage(cause),
          durationMs: nowMs() - runStartedAt,
          kind: "wall",
          label: `${lane.captureKind} failed`,
          runId,
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
};
