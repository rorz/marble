"use client";

import { MarbleClient } from "@marble/sdk";
import { useMemo } from "react";
import { env } from "@/env";
import { createClient } from "./supabase/browser";

type MarbleSdkOptions = {
  profileId?: string;
};

export function useMarbleSdkFactory() {
  const supabase = useMemo(() => createClient(), []);

  return useMemo(() => {
    const cache = new Map<string, MarbleClient>();

    return (options: MarbleSdkOptions = {}) => {
      const key = options.profileId ?? "";
      const existing = cache.get(key);

      if (existing) {
        return existing;
      }

      const sdk = new MarbleClient({
        driver: {
          client: supabase,
          profileId: options.profileId,
          type: "supabase",
        },
      });

      cache.set(key, sdk);
      return sdk;
    };
  }, [
    supabase,
  ]);
}

export function useMarbleSdk(options: MarbleSdkOptions = {}) {
  const { profileId } = options;
  const getSdk = useMarbleSdkFactory();

  return useMemo(
    () =>
      getSdk({
        profileId,
      }),
    [
      getSdk,
      profileId,
    ],
  );
}

export function useMarbleWebSessionSdk(options: MarbleSdkOptions = {}) {
  const { profileId } = options;

  return useMemo(
    () =>
      new MarbleClient({
        driver: {
          apiUrl: env.NEXT_PUBLIC_MARBLE_WEB_SESSION_API_URL,
          profileId,
          type: "web-session",
        },
      }),
    [
      profileId,
    ],
  );
}
