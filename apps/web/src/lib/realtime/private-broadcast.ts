"use client";

import { useEffect, useRef } from "react";
import { createClient } from "../supabase/browser";

type SupabaseBrowserClient = ReturnType<typeof createClient>;
type BroadcastFailure = {
  error: unknown;
  status: string;
  topic: string;
};
type PrivateBroadcastOptions<Payload> = {
  client?: SupabaseBrowserClient;
  enabled?: boolean;
  event: string;
  label?: string;
  onError?: (failure: BroadcastFailure) => void;
  onMessage: (payload: Payload) => void;
  onStatus?: (status: string) => void;
  onSubscribed?: () => void;
  topic: string;
};

const debugEnabled =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const debug = (
  label: string | undefined,
  topic: string,
  ...args: unknown[]
) => {
  if (!debugEnabled) {
    return;
  }
  console.debug(`[private-broadcast:${label ?? topic}]`, ...args);
};

export const usePrivateBroadcast = <Payload = unknown>({
  client,
  enabled = true,
  event,
  label,
  onError,
  onMessage,
  onStatus,
  onSubscribed,
  topic,
}: PrivateBroadcastOptions<Payload>) => {
  const fallbackClientRef = useRef<null | SupabaseBrowserClient>(null);
  fallbackClientRef.current ??= createClient();
  const supabase = client ?? fallbackClientRef.current;
  const callbacksRef = useRef({
    onError,
    onMessage,
    onStatus,
    onSubscribed,
  });
  callbacksRef.current = {
    onError,
    onMessage,
    onStatus,
    onSubscribed,
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const reportError = (failure: BroadcastFailure) => {
      if (label) {
        console.error(`${label} broadcast failed`, failure);
      }

      callbacksRef.current.onError?.(failure);
    };

    const subscribe = async () => {
      try {
        debug(label, topic, "subscribe.start");

        await supabase.realtime.setAuth();

        if (cancelled) {
          debug(label, topic, "subscribe.cancelled-after-setAuth");
          return;
        }

        const accessToken = supabase.realtime.accessTokenValue;
        debug(label, topic, "subscribe.setAuth-resolved", {
          hasAccessToken: Boolean(accessToken),
          tokenLength: accessToken?.length ?? 0,
        });

        channel = supabase
          .channel(topic, {
            config: {
              private: true,
            },
          })
          .on(
            "broadcast",
            {
              event,
            },
            (message) => {
              debug(label, topic, "broadcast.received", message.payload);
              callbacksRef.current.onMessage(message.payload as Payload);
            },
          )
          .subscribe((status, error) => {
            if (cancelled) {
              return;
            }

            debug(label, topic, "subscribe.status", {
              error,
              status,
            });
            callbacksRef.current.onStatus?.(status);

            if (status === "SUBSCRIBED") {
              callbacksRef.current.onSubscribed?.();
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || error) {
              reportError({
                error,
                status,
                topic,
              });
            }
          });
      } catch (error) {
        if (!cancelled) {
          reportError({
            error,
            status: "AUTH_ERROR",
            topic,
          });
        }
      }
    };

    void subscribe();

    return () => {
      cancelled = true;
      if (channel) {
        debug(label, topic, "subscribe.teardown");
        void supabase.removeChannel(channel);
      }
    };
  }, [
    enabled,
    event,
    label,
    supabase,
    topic,
  ]);
};
