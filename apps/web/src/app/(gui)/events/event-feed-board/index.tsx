"use client";

import { toCamelKeys } from "@marble/lib/object";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { isEventMutation } from "@/lib/realtime/event-mutations";
import { usePrivateBroadcast } from "@/lib/realtime/private-broadcast";
import { EventFeedDetail } from "./detail";
import { EventFeedList } from "./list";
import {
  type EventRow,
  type ProfileRow,
  parseDiffEntries,
  type RealtimeStatus,
  upsertEvent,
} from "./transforms";

export function EventFeedBoard({
  initialEvents,
  limit,
  profiles,
  userId,
}: {
  initialEvents: EventRow[];
  limit: number;
  profiles: ProfileRow[];
  userId: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [selectedEventId, setSelectedEventId] = useState<null | string>(
    initialEvents[0]?.id ?? null,
  );
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  const entryTimeouts = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const ownedProfileIds = useMemo(
    () => profiles.map((profile) => profile.id),
    [
      profiles,
    ],
  );
  const ownedProfileIdSet = useMemo(
    () => new Set(ownedProfileIds),
    [
      ownedProfileIds,
    ],
  );
  const enteringIdSet = useMemo(
    () => new Set(enteringIds),
    [
      enteringIds,
    ],
  );
  const profileById = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [
          profile.id,
          profile,
        ]),
      ),
    [
      profiles,
    ],
  );

  useEffect(() => {
    if (
      selectedEventId &&
      events.some((event) => event.id === selectedEventId)
    ) {
      return;
    }

    setSelectedEventId(events[0]?.id ?? null);
  }, [
    events,
    selectedEventId,
  ]);

  const markEntering = (eventId: string) => {
    startTransition(() => {
      setEnteringIds((current) =>
        current.includes(eventId)
          ? current
          : [
              eventId,
              ...current,
            ],
      );
    });

    const existingTimeout = entryTimeouts.current.get(eventId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      entryTimeouts.current.delete(eventId);
      startTransition(() => {
        setEnteringIds((current) =>
          current.filter((value) => value !== eventId),
        );
      });
    }, 320);

    entryTimeouts.current.set(eventId, timeout);
  };

  usePrivateBroadcast({
    enabled: ownedProfileIds.length > 0,
    event: "event_mutation",
    label: "Event feed",
    onError: () => setRealtimeStatus("error"),
    onMessage: (mutation) => {
      if (!isEventMutation(mutation)) {
        return;
      }

      const candidate =
        mutation.type === "event:upsert"
          ? (toCamelKeys(mutation.row) as EventRow)
          : null;
      const eventId =
        mutation.type === "event:delete" ? mutation.id : candidate?.id;
      const actorProfileId = candidate?.actorProfileId;

      if (
        typeof eventId !== "string" ||
        (mutation.type !== "event:delete" &&
          (typeof actorProfileId !== "string" ||
            !ownedProfileIdSet.has(actorProfileId)))
      ) {
        return;
      }

      startTransition(() => {
        setEvents((current) =>
          mutation.type === "event:delete"
            ? current.filter((event) => event.id !== eventId)
            : candidate
              ? upsertEvent(current, candidate, limit)
              : current,
        );
      });

      if (mutation.type === "event:upsert") {
        markEntering(eventId);
      }
    },
    onStatus: (status) => {
      if (status === "SUBSCRIBED") {
        setRealtimeStatus("live");
      }
    },
    topic: `events:user:${userId}`,
  });

  useEffect(
    () => () => {
      for (const timeout of entryTimeouts.current.values()) {
        clearTimeout(timeout);
      }
      entryTimeouts.current.clear();
    },
    [],
  );

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const selectedEventDiffEntries = selectedEvent
    ? parseDiffEntries(selectedEvent.diff)
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
        <EventFeedList
          enteringIdSet={enteringIdSet}
          events={events}
          limit={limit}
          onSelect={setSelectedEventId}
          profileById={profileById}
          profiles={profiles}
          realtimeStatus={realtimeStatus}
          selectedEventId={selectedEventId}
        />

        <EventFeedDetail
          diffEntries={selectedEventDiffEntries}
          profileById={profileById}
          selectedEvent={selectedEvent}
        />
      </div>
    </div>
  );
}
