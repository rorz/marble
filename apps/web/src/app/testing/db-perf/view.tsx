"use client";

import type { Database } from "@marble/supabase";
import {
  MarbleCard,
  MarbleCardContent,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleInput,
} from "@marble/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type TestingTag = Database["testing"]["Tables"]["tags"]["Row"];
type TelemetryEntry = {
  durationMs?: number;
  elapsedMs: number;
  id: number;
  label: string;
};

type PendingUpdate = {
  sequence: number;
  startedAt: number;
  value: string;
};

function nowMs() {
  return performance.now();
}

function formatMs(value: number) {
  return `${Math.round(value)}ms`;
}

export function DbPerfView() {
  const supabase = useMemo(() => createClient(), []);
  const insertStartedAtRef = useRef<null | number>(null);
  const pageStartedAtRef = useRef(nowMs());
  const pendingUpdatesRef = useRef<PendingUpdate[]>([]);
  const telemetryIdRef = useRef(0);
  const updateSequenceRef = useRef(0);
  const [tagId, setTagId] = useState<null | string>(null);
  const [draftValue, setDraftValue] = useState("");
  const [dbValue, setDbValue] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [commitPending, setCommitPending] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryEntry[]>([]);

  const appendTelemetry = useCallback((label: string, startedAt?: number) => {
    const currentTime = nowMs();
    telemetryIdRef.current += 1;

    const nextEntry = {
      durationMs:
        typeof startedAt === "number" ? currentTime - startedAt : undefined,
      elapsedMs: currentTime - pageStartedAtRef.current,
      id: telemetryIdRef.current,
      label,
    };

    setTelemetry((current) =>
      [
        ...current,
        nextEntry,
      ].slice(-12),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    let created = false;
    const id = crypto.randomUUID();

    setTagId(id);
    setDbValue(null);
    setError(null);

    const createTag = async () => {
      if (created) {
        return;
      }

      created = true;
      const startedAt = nowMs();

      insertStartedAtRef.current = startedAt;
      appendTelemetry("insert request");

      const { error: insertError } = await supabase
        .schema("testing")
        .from("tags")
        .insert({
          id,
          value: "",
        });

      if (!cancelled && insertError) {
        setError(insertError.message);
        appendTelemetry("insert failed", startedAt);
        return;
      }

      if (!cancelled) {
        appendTelemetry("insert returned", startedAt);
      }
    };

    const channel = supabase
      .channel("test.tag")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "testing",
          table: "tags",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            if (payload.old.id !== id) {
              return;
            }

            setDbValue(null);
            return;
          }

          const changedTag = payload.new as TestingTag;

          if (changedTag.id !== id) {
            return;
          }

          if (payload.eventType === "INSERT" && insertStartedAtRef.current) {
            appendTelemetry("insert realtime", insertStartedAtRef.current);
            insertStartedAtRef.current = null;
          } else if (payload.eventType === "UPDATE") {
            const updateIndex = pendingUpdatesRef.current.findIndex(
              (update) => update.value === changedTag.value,
            );
            const pendingUpdate = pendingUpdatesRef.current[updateIndex];

            if (pendingUpdate) {
              pendingUpdatesRef.current.splice(updateIndex, 1);
              appendTelemetry(
                `update ${pendingUpdate.sequence} realtime`,
                pendingUpdate.startedAt,
              );
            } else {
              appendTelemetry("update realtime");
            }
          }

          setDbValue(changedTag.value);
        },
      )
      .subscribe((status, subscribeError) => {
        if (status === "SUBSCRIBED") {
          appendTelemetry("listener subscribed");
          void createTag();
          return;
        }

        if (!cancelled && status === "CHANNEL_ERROR") {
          setError(subscribeError?.message ?? "Realtime channel failed.");
          appendTelemetry("listener failed");
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [
    appendTelemetry,
    supabase,
  ]);

  const commitDraftValue = useCallback(async () => {
    if (!tagId || commitPending) {
      return;
    }

    setCommitPending(true);
    setError(null);
    updateSequenceRef.current += 1;
    const sequence = updateSequenceRef.current;
    const startedAt = nowMs();

    pendingUpdatesRef.current.push({
      sequence,
      startedAt,
      value: draftValue,
    });
    appendTelemetry(`update ${sequence} request`);

    const { error: updateError } = await supabase
      .schema("testing")
      .from("tags")
      .update({
        value: draftValue,
      })
      .eq("id", tagId);

    if (updateError) {
      setError(updateError.message);
      pendingUpdatesRef.current = pendingUpdatesRef.current.filter(
        (update) => update.sequence !== sequence,
      );
      appendTelemetry(`update ${sequence} failed`, startedAt);
    } else {
      appendTelemetry(`update ${sequence} returned`, startedAt);
    }

    setCommitPending(false);
  }, [
    appendTelemetry,
    commitPending,
    draftValue,
    supabase,
    tagId,
  ]);

  return (
    <div className="flex size-full flex-col items-center justify-center p-4">
      <div className="size-full max-w-3xl">
        <MarbleCard>
          <MarbleCardHeader>
            <MarbleCardTitle>DB perf testing</MarbleCardTitle>
          </MarbleCardHeader>
          <MarbleCardContent>
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)] sm:items-end">
                <MarbleInput
                  aria-label="Tag value"
                  disabled={!tagId || commitPending}
                  onChange={(event) => {
                    setDraftValue(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }

                    event.preventDefault();
                    void commitDraftValue();
                  }}
                  placeholder="Commit with Enter"
                  value={draftValue}
                />
                <p className="min-h-9 rounded-sm border border-dashed border-neutral-400 bg-white px-2 py-1.5 text-base text-neutral-900">
                  {dbValue}
                </p>
              </div>
              {error ? (
                <p
                  className="text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              {telemetry.length > 0 ? (
                <ol className="space-y-1 font-mono text-[11px] leading-4 text-neutral-500">
                  {telemetry.map((entry) => (
                    <li
                      className="grid grid-cols-[4rem_minmax(0,1fr)_4rem] gap-2"
                      key={entry.id}
                    >
                      <span className="tabular-nums">
                        +{formatMs(entry.elapsedMs)}
                      </span>
                      <span>{entry.label}</span>
                      <span className="text-right tabular-nums">
                        {typeof entry.durationMs === "number"
                          ? formatMs(entry.durationMs)
                          : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </MarbleCardContent>
        </MarbleCard>
      </div>
    </div>
  );
}
