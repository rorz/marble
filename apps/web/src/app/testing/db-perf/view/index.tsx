"use client";

import {
  MarbleCard,
  MarbleCardContent,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleInput,
} from "@marble/ui";
import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { MixedTelemetry, ProbeDbState } from "./panels";
import type { MixedTelemetryEntry } from "./types";
import { useTagProbe } from "./use-tag-probe";

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
