"use client";

import { MarbleClient } from "@marble/sdk";
import { useMemo } from "react";
import { createClient } from "./supabase/browser";

export function useMarbleSdk(options: { profileId?: string } = {}) {
  const { profileId } = options;
  const supabase = useMemo(() => createClient(), []);

  return useMemo(
    () =>
      new MarbleClient({
        driver: {
          client: supabase,
          profileId,
          type: "supabase",
        },
      }),
    [
      profileId,
      supabase,
    ],
  );
}
