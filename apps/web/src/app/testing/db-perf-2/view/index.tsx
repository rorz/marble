"use client";

import { getErrorMessage } from "@marble/lib/result";
import {
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
import { createSupabaseMarbleClient } from "./client";
import { lanes, sourcePayloadSchema } from "./constants";
import { LanePanel, TimingPanel } from "./panels";
import { nowMs, shortId, sourceToSnapshot } from "./timing";
import type { SdkProject, SourceSnapshot, TimingEntry } from "./types";
import { useBroadcastSubscription } from "./use-broadcast-subscription";
import { useCaptureLane } from "./use-capture-lane";

export const DbPerf2View = () => {
  const supabase = useMemo(() => createClient(), []);
  const pageStartedAtRef = useRef(nowMs());
  const timingIdRef = useRef(0);
  const [draftValue, setDraftValue] = useState("hello from db-perf-2");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<SourceSnapshot | null>(null);
  const [setupPending, setSetupPending] = useState(true);
  const [timings, setTimings] = useState<TimingEntry[]>([]);

  const appendTiming = useCallback(
    (entry: Omit<TimingEntry, "elapsedMs" | "id" | "key">) => {
      const currentTime = nowMs();
      timingIdRef.current += 1;

      setTimings((current) =>
        [
          ...current,
          {
            ...entry,
            elapsedMs: currentTime - pageStartedAtRef.current,
            id: timingIdRef.current,
            key: crypto.randomUUID(),
          },
        ].slice(-64),
      );
    },
    [],
  );

  const sdk = useMemo(
    () => createSupabaseMarbleClient(supabase),
    [
      supabase,
    ],
  );

  const measureSetup = useCallback(
    async <T,>(label: string, task: () => Promise<T>) => {
      const startedAt = nowMs();

      try {
        const result = await task();
        appendTiming({
          durationMs: nowMs() - startedAt,
          kind: "setup",
          label,
          laneId: "setup",
          status: "ok",
        });
        return result;
      } catch (cause) {
        appendTiming({
          detail: getErrorMessage(cause),
          durationMs: nowMs() - startedAt,
          kind: "setup",
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

    const startedAt = nowMs();
    await Promise.all(
      laneStates.map((lane) => lane.run(draftValue, startedAt)),
    );
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
};
