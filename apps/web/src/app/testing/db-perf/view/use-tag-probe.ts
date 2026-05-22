import { getErrorMessage } from "@marble/lib/result";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBroadcastTag, getPostgresTag, nowMs, tagTopic } from "./timing";
import type {
  BroadcastTagPayload,
  BrowserSupabaseClient,
  PendingUpdate,
  PostgresTagPayload,
  ProbeKind,
  ProbeState,
  TelemetryEntry,
  TestingTag,
} from "./types";

export const useTagProbe = ({
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
