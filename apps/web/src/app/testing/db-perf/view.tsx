"use client";

// harness-ignore: max-file-lines -- realtime perf scratch surface; intentionally kept as one file

import { getErrorMessage } from "@marble/lib/result";
import type { Database } from "@marble/supabase";
import {
  cx,
  MarbleCard,
  MarbleCardContent,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleInput,
} from "@marble/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type BrowserSupabaseClient = ReturnType<typeof createClient>;
type TestingTag = Database["testing"]["Tables"]["tags"]["Row"];
type ProbeKind = "broadcast" | "postgres";

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

type ProbeState = {
  commit: (value: string) => Promise<void>;
  dbValue: null | string;
  error: null | string;
  kind: ProbeKind;
  pending: boolean;
  ready: boolean;
  telemetry: TelemetryEntry[];
};

type PostgresTagPayload =
  | {
      eventType: "DELETE";
      old: Partial<TestingTag>;
    }
  | {
      eventType: "INSERT" | "UPDATE";
      new: TestingTag;
    };

type BroadcastTagPayload = {
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

type MixedTelemetryEntry = TelemetryEntry & {
  key: string;
  kind: ProbeKind;
};

const probeStyles = {
  broadcast: {
    dbStateClassName: "border-emerald-300 bg-emerald-50/70",
    dotClassName: "bg-emerald-500",
    label: "Broadcast",
    shortLabel: "broadcast",
    telemetryClassName: "border-emerald-400",
    textClassName: "text-emerald-700",
  },
  postgres: {
    dbStateClassName: "border-sky-300 bg-sky-50/70",
    dotClassName: "bg-sky-500",
    label: "Postgres Changes",
    shortLabel: "postgres",
    telemetryClassName: "border-sky-400",
    textClassName: "text-sky-700",
  },
} satisfies Record<
  ProbeKind,
  {
    dbStateClassName: string;
    dotClassName: string;
    label: string;
    shortLabel: string;
    telemetryClassName: string;
    textClassName: string;
  }
>;

const nowMs = () => {
  return performance.now();
};

const formatMs = (value: number) => {
  return `${Math.round(value)}ms`;
};

const tagTopic = (id: string) => {
  return `testing:tags:${id}`;
};

const getPostgresTag = (payload: PostgresTagPayload) => {
  if (payload.eventType === "DELETE") {
    return payload.old;
  }

  return payload.new;
};

const getBroadcastTag = (payload: BroadcastTagPayload) => {
  if (payload.payload.operation === "DELETE") {
    return payload.payload.old_record;
  }

  return payload.payload.record;
};

const useTagProbe = ({
  kind,
  supabase,
}: Readonly<{
  kind: ProbeKind;
  supabase: BrowserSupabaseClient;
}>): ProbeState => {
  const insertStartedAtRef = useRef<null | number>(null);
  const pageStartedAtRef = useRef(nowMs());
  const pendingUpdatesRef = useRef<PendingUpdate[]>([]);
  const tagIdRef = useRef<null | string>(null);
  const telemetryIdRef = useRef(0);
  const updateSequenceRef = useRef(0);
  const [dbValue, setDbValue] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
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
      ].slice(-10),
    );
  }, []);

  const handleObservedTag = useCallback(
    ({
      eventType,
      tag,
    }: {
      eventType: "DELETE" | "INSERT" | "UPDATE";
      tag: Partial<TestingTag> | null;
    }) => {
      if (!tag || tag.id !== tagIdRef.current) {
        return;
      }

      if (eventType === "DELETE") {
        setDbValue(null);
        appendTelemetry("delete realtime");
        return;
      }

      if (eventType === "INSERT" && insertStartedAtRef.current) {
        appendTelemetry("insert realtime", insertStartedAtRef.current);
        insertStartedAtRef.current = null;
      } else if (eventType === "UPDATE" && "value" in tag) {
        const updateIndex = pendingUpdatesRef.current.findIndex(
          (update) => update.value === tag.value,
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

      setDbValue(
        "value" in tag && typeof tag.value === "string" ? tag.value : null,
      );
    },
    [
      appendTelemetry,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    let created = false;
    const id = crypto.randomUUID();

    tagIdRef.current = id;
    setDbValue(null);
    setError(null);
    setReady(false);
    setTelemetry([]);
    pendingUpdatesRef.current = [];
    insertStartedAtRef.current = null;

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
        setReady(true);
        appendTelemetry("insert returned", startedAt);
      }
    };

    if (kind === "postgres") {
      const channel = supabase
        .channel("test.tag.postgres")
        .on<TestingTag>(
          "postgres_changes",
          {
            event: "*",
            schema: "testing",
            table: "tags",
          },
          (payload) => {
            const change = payload as PostgresTagPayload;

            handleObservedTag({
              eventType: change.eventType,
              tag: getPostgresTag(change),
            });
          },
        )
        .subscribe((status, subscribeError) => {
          if (status === "SUBSCRIBED") {
            appendTelemetry("listener subscribed");
            void createTag();
            return;
          }

          if (!cancelled && status === "CHANNEL_ERROR") {
            setError(subscribeError?.message ?? "Postgres channel failed.");
            appendTelemetry("listener failed");
          }
        });

      return () => {
        cancelled = true;
        tagIdRef.current = null;
        void supabase.removeChannel(channel);
      };
    }

    let channel: ReturnType<BrowserSupabaseClient["channel"]> | null = null;

    const setupBroadcast = async () => {
      try {
        appendTelemetry("auth request");
        await supabase.realtime.setAuth();

        if (cancelled) {
          return;
        }

        appendTelemetry("auth ready");

        channel = supabase
          .channel(tagTopic(id), {
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
              const change = payload as BroadcastTagPayload;

              handleObservedTag({
                eventType: change.payload.operation,
                tag: getBroadcastTag(change),
              });
            },
          )
          .on(
            "broadcast",
            {
              event: "UPDATE",
            },
            (payload) => {
              const change = payload as BroadcastTagPayload;

              handleObservedTag({
                eventType: change.payload.operation,
                tag: getBroadcastTag(change),
              });
            },
          )
          .on(
            "broadcast",
            {
              event: "DELETE",
            },
            (payload) => {
              const change = payload as BroadcastTagPayload;

              handleObservedTag({
                eventType: change.payload.operation,
                tag: getBroadcastTag(change),
              });
            },
          )
          .subscribe((status, subscribeError) => {
            if (status === "SUBSCRIBED") {
              appendTelemetry("listener subscribed");
              void createTag();
              return;
            }

            if (!cancelled && status === "CHANNEL_ERROR") {
              setError(subscribeError?.message ?? "Broadcast channel failed.");
              appendTelemetry("listener failed");
            }
          });
      } catch (cause) {
        if (!cancelled) {
          setError(getErrorMessage(cause, "Broadcast auth failed."));
          appendTelemetry("auth failed");
        }
      }
    };

    void setupBroadcast();

    return () => {
      cancelled = true;
      tagIdRef.current = null;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [
    appendTelemetry,
    handleObservedTag,
    kind,
    supabase,
  ]);

  const commit = useCallback(
    async (value: string) => {
      const tagId = tagIdRef.current;

      if (!tagId || pending) {
        return;
      }

      setPending(true);
      setError(null);
      updateSequenceRef.current += 1;
      const sequence = updateSequenceRef.current;
      const startedAt = nowMs();

      pendingUpdatesRef.current.push({
        sequence,
        startedAt,
        value,
      });
      appendTelemetry(`update ${sequence} request`);

      const { error: updateError } = await supabase
        .schema("testing")
        .from("tags")
        .update({
          value,
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

      setPending(false);
    },
    [
      appendTelemetry,
      pending,
      supabase,
    ],
  );

  return {
    commit,
    dbValue,
    error,
    kind,
    pending,
    ready,
    telemetry,
  };
};

const ProbeDbState = ({
  probe,
}: Readonly<{
  probe: ProbeState;
}>) => {
  const styles = probeStyles[probe.kind];

  return (
    <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-start gap-2">
      <span
        className={cx(
          "flex items-center justify-end gap-1 pt-2 font-medium text-xs",
          styles.textClassName,
        )}
      >
        <span className={cx("size-1.5 rounded-full", styles.dotClassName)} />
        {styles.shortLabel}
      </span>
      <p
        className={cx(
          "min-h-9 rounded-sm border border-dashed px-2 py-1.5 text-base text-neutral-900",
          styles.dbStateClassName,
        )}
      >
        {probe.dbValue}
      </p>
      {probe.error ? (
        <p
          className="col-start-2 text-sm text-red-700"
          role="alert"
        >
          {probe.error}
        </p>
      ) : null}
    </div>
  );
};

const MixedTelemetry = ({
  entries,
}: Readonly<{
  entries: MixedTelemetryEntry[];
}>) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <ol className="space-y-1 border-neutral-200 border-t pt-3 font-mono text-[11px] leading-4 text-neutral-500">
      {entries.map((entry) => {
        const styles = probeStyles[entry.kind];

        return (
          <li
            className="grid grid-cols-[4rem_5.75rem_minmax(0,1fr)_4rem] gap-2"
            key={entry.key}
          >
            <span className="tabular-nums">+{formatMs(entry.elapsedMs)}</span>
            <span
              className={cx(
                "flex items-center gap-1 font-medium",
                styles.textClassName,
              )}
            >
              <span
                className={cx("size-1.5 rounded-full", styles.dotClassName)}
              />
              {styles.shortLabel}
            </span>
            <span>{entry.label}</span>
            <span className="text-right tabular-nums">
              {typeof entry.durationMs === "number"
                ? formatMs(entry.durationMs)
                : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export const DbPerfView = () => {
  const supabase = useMemo(() => createClient(), []);
  const postgresProbe = useTagProbe({
    kind: "postgres",
    supabase,
  });
  const broadcastProbe = useTagProbe({
    kind: "broadcast",
    supabase,
  });
  const [draftValue, setDraftValue] = useState("");
  const commitPending = postgresProbe.pending || broadcastProbe.pending;
  const commitDisabled =
    commitPending || !postgresProbe.ready || !broadcastProbe.ready;
  const mixedTelemetry = useMemo<MixedTelemetryEntry[]>(
    () =>
      [
        ...postgresProbe.telemetry.map((entry) => ({
          ...entry,
          key: `postgres-${entry.id}`,
          kind: "postgres" as const,
        })),
        ...broadcastProbe.telemetry.map((entry) => ({
          ...entry,
          key: `broadcast-${entry.id}`,
          kind: "broadcast" as const,
        })),
      ]
        .sort((left, right) => left.elapsedMs - right.elapsedMs)
        .slice(-20),
    [
      broadcastProbe.telemetry,
      postgresProbe.telemetry,
    ],
  );

  const commitDraftValue = useCallback(async () => {
    if (commitDisabled) {
      return;
    }

    await Promise.all([
      postgresProbe.commit(draftValue),
      broadcastProbe.commit(draftValue),
    ]);
  }, [
    broadcastProbe,
    commitDisabled,
    draftValue,
    postgresProbe,
  ]);

  return (
    <div className="flex size-full flex-col items-center justify-center p-4">
      <div className="size-full max-w-5xl">
        <MarbleCard>
          <MarbleCardHeader>
            <MarbleCardTitle>DB perf testing</MarbleCardTitle>
          </MarbleCardHeader>
          <MarbleCardContent>
            <div className="flex flex-col gap-5">
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]">
                <MarbleInput
                  aria-label="Tag value"
                  disabled={commitDisabled}
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
                  placeholder="Commit both paths with Enter"
                  value={draftValue}
                />
                <div className="flex flex-col gap-2">
                  <ProbeDbState probe={postgresProbe} />
                  <ProbeDbState probe={broadcastProbe} />
                </div>
              </div>
              <MixedTelemetry entries={mixedTelemetry} />
            </div>
          </MarbleCardContent>
        </MarbleCard>
      </div>
    </div>
  );
};
