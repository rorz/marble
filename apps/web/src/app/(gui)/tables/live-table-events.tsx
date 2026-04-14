"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/browser";

export function LiveTableEvents() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel("table-events:index")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table",
        },
        () => {
          if (refreshTimeout) {
            return;
          }

          refreshTimeout = setTimeout(() => {
            refreshTimeout = null;
            router.refresh();
          }, 100);
        },
      )
      .subscribe();

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      supabase.removeChannel(channel);
    };
  }, [
    router,
    supabase,
  ]);

  return null;
}
