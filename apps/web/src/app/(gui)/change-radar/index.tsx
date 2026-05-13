"use client";
// harness-ignore: max-file-lines -- single dense state machine: ChangeRadar wraps realtime event broadcast + radar batching + preview spotlight orchestration via shared refs; lifting would obscure dataflow

import { toCamelKeys } from "@marble/lib/object";
import {
  cx,
  type MarbleActivityRadarBatch,
  MarbleActivityRadarPanel,
  useMarbleRouter,
} from "@marble/ui";
import { RobotIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useState } from "react";
import { useMarbleWebSessionSdk } from "../../../lib/marble-sdk-client";
import { isEventMutation } from "../../../lib/realtime/event-mutations";
import { usePrivateBroadcast } from "../../../lib/realtime/private-broadcast";
import type { SidebarTreeData } from "../../../lib/sidebar-tree";
import { createClient } from "../../../lib/supabase/browser";
import {
  clearPreviewChangeSpotlight,
  previewChangeSpotlight,
  queueChangeSpotlightDeck,
} from "../change-spotlight";
import { buildRadarBatches } from "./batches";
import {
  CHANGE_RADAR_EVENT_LIMIT,
  CHANGE_RADAR_STORAGE_KEY,
} from "./constants";
import {
  type EventRow,
  formatRadarRelativeTime,
  formatUnreadCount,
  getEventSnapshot,
  getStringField,
  upsertRadarEvent,
} from "./event-snapshot";
import { buildRadarIndexes, type ResolutionMaps } from "./indexes";

type ChangeRadarProps = {
  className?: string;
  headerActions?: ReactNode;
  mode?: "panel" | "trigger";
  onToggleSidebar?: () => void;
  sidebarData: SidebarTreeData;
};

export function ChangeRadar({
  className,
  headerActions,
  mode = "panel",
  onToggleSidebar,
  sidebarData,
}: ChangeRadarProps) {
  const router = useMarbleRouter();
  const [supabase] = useState(() => createClient());
  const sdk = useMarbleWebSessionSdk();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [lastReviewedAt, setLastReviewedAt] = useState<null | string>(null);
  const [resolutionMaps, setResolutionMaps] = useState<ResolutionMaps>({
    columnTableIds: {},
    rowTableIds: {},
    versionProgramIds: {},
  });
  const ownedProfileIds = sidebarData.ownerProfileIds;
  const userId = sidebarData.userId;
  const indexes = buildRadarIndexes(sidebarData);

  const persistReviewWatermark = (value: null | string) => {
    setLastReviewedAt(value);

    if (typeof window === "undefined") {
      return;
    }

    if (value === null) {
      window.localStorage.removeItem(CHANGE_RADAR_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CHANGE_RADAR_STORAGE_KEY, value);
  };

  const markReviewedThrough = (value: null | string) => {
    if (!value) {
      return;
    }

    if (lastReviewedAt && value.localeCompare(lastReviewedAt) <= 0) {
      return;
    }

    persistReviewWatermark(value);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setLastReviewedAt(
      window.localStorage.getItem(CHANGE_RADAR_STORAGE_KEY) ?? null,
    );
  }, []);

  useEffect(() => {
    if (ownedProfileIds.length === 0) {
      setEvents([]);
      return;
    }

    let cancelled = false;
    void sdk.events
      .listForCurrentUser({
        excludeSources: [
          "WEB_APP",
        ],
        limit: CHANGE_RADAR_EVENT_LIMIT,
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        setEvents(data.filter((event) => event.operation !== "Read"));
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Change radar bootstrap failed", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    ownedProfileIds,
    sdk,
  ]);

  usePrivateBroadcast({
    client: supabase,
    enabled: ownedProfileIds.length > 0,
    event: "event_mutation",
    label: "Change radar",
    onMessage: (mutation) => {
      if (!isEventMutation(mutation)) {
        return;
      }

      const ownedProfileIdSet = new Set(ownedProfileIds);
      const candidate =
        mutation.type === "event:upsert"
          ? (toCamelKeys(mutation.row) as EventRow)
          : null;
      const eventId =
        mutation.type === "event:delete" ? mutation.id : candidate?.id;

      if (
        typeof eventId !== "string" ||
        (candidate &&
          (typeof candidate.actorProfileId !== "string" ||
            !ownedProfileIdSet.has(candidate.actorProfileId) ||
            candidate.source === "WEB_APP" ||
            candidate.operation === "Read"))
      ) {
        return;
      }

      setEvents((current) =>
        mutation.type === "event:delete"
          ? current.filter((event) => event.id !== eventId)
          : candidate
            ? upsertRadarEvent(current, candidate)
            : current,
      );
    },
    topic: `events:user:${userId}`,
  });

  useEffect(() => {
    const pendingRows = new Set<string>();
    const pendingColumns = new Set<string>();
    const pendingVersions = new Set<string>();

    for (const event of events) {
      const snapshot = getEventSnapshot(event);

      if (event.resource === "cell") {
        const rowId = getStringField(snapshot, "row_id");
        const columnId = getStringField(snapshot, "column_id");

        if (rowId && resolutionMaps.rowTableIds[rowId] === undefined) {
          pendingRows.add(rowId);
        }

        if (columnId && resolutionMaps.columnTableIds[columnId] === undefined) {
          pendingColumns.add(columnId);
        }
      }

      if (event.resource === "column_dependency") {
        const sourceColumnId = getStringField(snapshot, "source_column_id");
        const targetColumnId = getStringField(snapshot, "target_column_id");

        if (
          sourceColumnId &&
          resolutionMaps.columnTableIds[sourceColumnId] === undefined
        ) {
          pendingColumns.add(sourceColumnId);
        }

        if (
          targetColumnId &&
          resolutionMaps.columnTableIds[targetColumnId] === undefined
        ) {
          pendingColumns.add(targetColumnId);
        }
      }

      if (
        event.resource === "program_file" ||
        event.resource === "program_run"
      ) {
        const versionId =
          getStringField(snapshot, "version_id") ??
          getStringField(snapshot, "program_version_id");

        if (
          versionId &&
          resolutionMaps.versionProgramIds[versionId] === undefined
        ) {
          pendingVersions.add(versionId);
        }
      }
    }

    if (
      pendingRows.size === 0 &&
      pendingColumns.size === 0 &&
      pendingVersions.size === 0
    ) {
      return;
    }

    let cancelled = false;

    void sdk.events
      .resolveTargets({
        columnIds: Array.from(pendingColumns),
        programVersionIds: Array.from(pendingVersions),
        rowIds: Array.from(pendingRows),
      })
      .then((resolved) => {
        if (cancelled) {
          return;
        }

        setResolutionMaps((current) => ({
          columnTableIds: {
            ...current.columnTableIds,
            ...resolved.columnTableIds,
          },
          rowTableIds: {
            ...current.rowTableIds,
            ...resolved.rowTableIds,
          },
          versionProgramIds: {
            ...current.versionProgramIds,
            ...resolved.versionProgramIds,
          },
        }));
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Change radar resolution failed", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    events,
    resolutionMaps,
    sdk,
  ]);

  const batchRecords = buildRadarBatches(
    events,
    indexes,
    resolutionMaps,
    lastReviewedAt,
  );
  const batches: MarbleActivityRadarBatch[] = batchRecords.map((batch) => ({
    actors: batch.actors,
    description: batch.description,
    id: batch.id,
    label: batch.label,
    onPreviewEnd: clearPreviewChangeSpotlight,
    onPreviewStart: () => previewChangeSpotlight(batch.targetKeys),
    onSelect: () => {
      markReviewedThrough(batch.latestAt);
      clearPreviewChangeSpotlight();
      queueChangeSpotlightDeck(
        batchRecords.map((record) => ({
          description: record.description,
          detailItems: record.detailItems,
          href: record.href,
          id: record.id,
          label: record.label,
          targetKeys: record.targetKeys,
        })),
        batch.id,
      );
      router.push(batch.href);
    },
    segments: batch.segments,
    timestampLabel: formatRadarRelativeTime(batch.latestAt),
    unread: batch.unread,
  }));
  const unreadCount = batchRecords.filter((batch) => batch.unread).length;

  if (mode === "trigger") {
    return (
      <button
        aria-label={`Expand agent sidebar${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className={cx(
          "relative flex size-9 items-center justify-center rounded-full border border-taupe-300/80 bg-white/95 text-taupe-600 shadow-[0_8px_18px_rgba(84,57,26,0.14)] transition-[background-color,color,box-shadow,transform] hover:bg-white hover:text-taupe-950 hover:shadow-[0_12px_24px_rgba(84,57,26,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300",
          className,
        )}
        onClick={onToggleSidebar}
        title="Expand agent sidebar"
        type="button"
      >
        <RobotIcon
          aria-hidden="true"
          className="size-5"
          weight={unreadCount > 0 ? "fill" : "regular"}
        />
        {unreadCount > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full border border-white bg-orange-500 px-1 font-mono text-[9px] leading-4 text-white shadow-[0_6px_12px_rgba(84,57,26,0.16)]">
            {formatUnreadCount(unreadCount)}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <MarbleActivityRadarPanel
      actions={headerActions}
      batches={batches}
      className={className}
      onMarkAllRead={() =>
        markReviewedThrough(batchRecords[0]?.latestAt ?? null)
      }
      unreadCount={unreadCount}
    />
  );
}
