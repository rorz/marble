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
  topic: string;
};

export const usePrivateBroadcast = <Payload = unknown>({
  client,
  enabled = true,
  event,
  label,
  onError,
  onMessage,
  onStatus,
  topic,
}: PrivateBroadcastOptions<Payload>) => {
  const fallbackClientRef = useRef<null | SupabaseBrowserClient>(null);
  fallbackClientRef.current ??= createClient();
  const supabase = client ?? fallbackClientRef.current;
  const callbacksRef = useRef({
    onError,
    onMessage,
    onStatus,
  });
  callbacksRef.current = {
    onError,
    onMessage,
    onStatus,
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
        await supabase.realtime.setAuth();

        if (cancelled) {
          return;
        }

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
              callbacksRef.current.onMessage(message.payload as Payload);
            },
          )
          .subscribe((status, error) => {
            if (cancelled) {
              return;
            }

            callbacksRef.current.onStatus?.(status);

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
      if (channel) void supabase.removeChannel(channel);
    };
  }, [
    enabled,
    event,
    label,
    supabase,
    topic,
  ]);
};
