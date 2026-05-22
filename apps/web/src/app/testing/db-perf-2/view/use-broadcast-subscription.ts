import { getErrorMessage } from "@marble/lib/result";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dbEventToSnapshot, sourceEventTopic } from "./timing";
import type {
  BroadcastObserver,
  BroadcastSourceEventPayload,
  BroadcastSubscription,
  BrowserSupabaseClient,
  LaneStatus,
} from "./types";

export const useBroadcastSubscription = ({
  sourceId,
  supabase,
}: Readonly<{
  sourceId: string | null;
  supabase: BrowserSupabaseClient;
}>): BroadcastSubscription => {
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
};
