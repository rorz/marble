import { sortBy as sortRows } from "@marble/lib/array";
import { castCamelKeys, isPlainRecord } from "@marble/lib/object";
import { useEffect, useMemo, useState } from "react";
import type { MarbleSourceEvent } from "../../../../../../lib/marble-resources";
import { usePrivateBroadcast } from "../../../../../../lib/realtime/private-broadcast";
import { compareByCreatedAtCamelDesc } from "../../../../../../lib/realtime-crud";
import type { SourceEvent } from "./types";

export const useSourceEvents = ({
  initialEvents,
  sourceId,
}: {
  initialEvents: SourceEvent[];
  sourceId: string;
}) => {
  const [sourceEvents, setSourceEvents] = useState(() =>
    sortRows(initialEvents, compareByCreatedAtCamelDesc),
  );
  const [selectedSourceEventId, setSelectedSourceEventId] = useState<
    null | string
  >(null);
  const selectedSourceEvents = useMemo(
    () =>
      sortRows(
        sourceEvents.filter((event) => event.sourceId === sourceId),
        compareByCreatedAtCamelDesc,
      ),
    [
      sourceId,
      sourceEvents,
    ],
  );
  const selectedSourceEvent =
    selectedSourceEventId && selectedSourceEvents.length > 0
      ? (selectedSourceEvents.find(
          (event) => event.id === selectedSourceEventId,
        ) ?? null)
      : (selectedSourceEvents[0] ?? null);

  useEffect(() => {
    setSelectedSourceEventId(selectedSourceEvents[0]?.id ?? null);
  }, [
    selectedSourceEvents,
  ]);

  usePrivateBroadcast({
    enabled: Boolean(sourceId),
    event: "INSERT",
    label: "Source event",
    onMessage: (payload) => {
      const record = isPlainRecord(payload) ? payload.record : null;

      if (!isPlainRecord(record)) {
        return;
      }

      const nextEvent = castCamelKeys<MarbleSourceEvent>(record);

      if (nextEvent.sourceId !== sourceId) {
        return;
      }

      setSourceEvents((current) =>
        sortRows(
          [
            nextEvent,
            ...current.filter((event) => event.id !== nextEvent.id),
          ],
          compareByCreatedAtCamelDesc,
        ).slice(0, 120),
      );
    },
    topic: `source-events:${sourceId}`,
  });

  const removeSourceEvents = (sourceIdToRemove: string) => {
    setSourceEvents((current) =>
      current.filter((event) => event.sourceId !== sourceIdToRemove),
    );
  };

  return {
    removeSourceEvents,
    selectedSourceEvent,
    selectedSourceEvents,
    setSelectedSourceEventId,
  };
};
