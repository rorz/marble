"use client";

import type { Database } from "@marble/supabase";
import {
  MarbleActivityRadar,
  type MarbleActivityRadarBatch,
  type MarbleActivityRadarSegment,
  type MarbleProfileAttributionProfile,
  type MarbleReviewNavigatorDetailItem,
} from "@marble/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { RealtimePayload } from "../../lib/realtime-crud";
import type { SidebarTreeData } from "../../lib/sidebar-tree";
import { createClient } from "../../lib/supabase/browser";
import {
  changeTargetKey,
  clearPreviewChangeSpotlight,
  previewChangeSpotlight,
  queueChangeSpotlightDeck,
} from "./change-spotlight";

type ChangeRadarProps = {
  className?: string;
  compact?: boolean;
  sidebarData: SidebarTreeData;
};

type EventRow = Database["public"]["Tables"]["event"]["Row"];
type EventOperation = EventRow["operation"];
type ResolutionMaps = {
  columnTableIds: Record<string, null | string>;
  rowTableIds: Record<string, null | string>;
  versionProgramIds: Record<string, null | string>;
};
type RadarIndexes = {
  profiles: Map<string, MarbleProfileAttributionProfile>;
  programs: Map<string, string>;
  projects: Map<string, string>;
  tables: Map<
    string,
    {
      label: string;
      projectId: string;
    }
  >;
};
type RadarScope = {
  href: string;
  key: string;
  label: string;
  targetKeys: string[];
};
type RadarBatchRecord = {
  actors: MarbleProfileAttributionProfile[];
  burstCount: number;
  description: string;
  detailItems: MarbleReviewNavigatorDetailItem[];
  href: string;
  id: string;
  label: string;
  latestAt: string;
  segments: MarbleActivityRadarSegment[];
  targetKeys: string[];
  unread: boolean;
};

const CHANGE_RADAR_BUCKET_MS = 20_000;
const CHANGE_RADAR_EVENT_LIMIT = 72;
const CHANGE_RADAR_TARGET_LIMIT = 24;
const CHANGE_RADAR_STORAGE_KEY = "marble:change-radar:last-reviewed-at";
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function pluralize(label: string, count: number) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function formatRadarRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const absDiffMs = Math.abs(diffMs);

  if (absDiffMs < 15_000) {
    return "now";
  }

  if (absDiffMs < 3_600_000) {
    return `${Math.round(absDiffMs / 60_000)}m`;
  }

  if (absDiffMs < 86_400_000) {
    return `${Math.round(absDiffMs / 3_600_000)}h`;
  }

  return `${Math.round(absDiffMs / 86_400_000)}d`;
}

function getEventSnapshot(event: EventRow) {
  if (isRecord(event.after_state)) {
    return event.after_state;
  }

  if (isRecord(event.before_state)) {
    return event.before_state;
  }

  return null;
}

function getStringField(snapshot: Record<string, unknown> | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildRadarIndexes(sidebarData: SidebarTreeData) {
  const indexes: RadarIndexes = {
    profiles: new Map(),
    programs: new Map(),
    projects: new Map(),
    tables: new Map(),
  };

  for (const profile of sidebarData.profiles) {
    indexes.profiles.set(profile.id, {
      externalName: profile.external_name,
      icon: profile.icon,
      id: profile.id,
      name: profile.name || "Untitled Profile",
      type: profile.type,
    });
  }

  for (const node of sidebarData.programs) {
    indexes.programs.set(node.id, node.label);
  }

  for (const projectNode of sidebarData.projects) {
    indexes.projects.set(projectNode.id, projectNode.label);

    for (const tableNode of projectNode.children) {
      indexes.tables.set(tableNode.id, {
        label: tableNode.label,
        projectId: projectNode.id,
      });
    }
  }

  return indexes;
}

function buildTableHref(
  indexes: RadarIndexes,
  tableId: string,
  explicitProjectId?: string,
) {
  const projectId = explicitProjectId ?? indexes.tables.get(tableId)?.projectId;

  return projectId
    ? `/projects/${projectId}/tables/${tableId}`
    : `/tables/${tableId}`;
}

function buildTableLabel(indexes: RadarIndexes, tableId: string) {
  return indexes.tables.get(tableId)?.label ?? `Table ${shortId(tableId)}`;
}

function buildProgramHref(programId?: string) {
  return programId ? `/programs/${programId}` : "/programs";
}

function resolveEventTargetKeys(
  event: EventRow,
  resolutionMaps: ResolutionMaps,
) {
  const snapshot = getEventSnapshot(event);

  if (event.resource === "project") {
    return [
      changeTargetKey.project(event.entity_id),
    ];
  }

  if (event.resource === "table") {
    return [
      changeTargetKey.table(event.entity_id),
    ];
  }

  if (event.resource === "row") {
    const tableId = getStringField(snapshot, "table_id");

    return [
      changeTargetKey.row(event.entity_id),
      ...(tableId
        ? [
            changeTargetKey.table(tableId),
          ]
        : []),
    ];
  }

  if (event.resource === "column") {
    const tableId = getStringField(snapshot, "table_id");

    return [
      changeTargetKey.column(event.entity_id),
      ...(tableId
        ? [
            changeTargetKey.table(tableId),
          ]
        : []),
    ];
  }

  if (event.resource === "cell") {
    const rowId = getStringField(snapshot, "row_id");
    const columnId = getStringField(snapshot, "column_id");
    const tableId =
      (rowId ? resolutionMaps.rowTableIds[rowId] : undefined) ??
      (columnId ? resolutionMaps.columnTableIds[columnId] : undefined);

    return [
      ...(rowId && columnId
        ? [
            changeTargetKey.cell(rowId, columnId),
          ]
        : []),
      ...(rowId
        ? [
            changeTargetKey.row(rowId),
          ]
        : []),
      ...(columnId
        ? [
            changeTargetKey.column(columnId),
          ]
        : []),
      ...(tableId
        ? [
            changeTargetKey.table(tableId),
          ]
        : []),
    ];
  }

  if (event.resource === "column_dependency") {
    const sourceColumnId = getStringField(snapshot, "source_column_id");
    const targetColumnId = getStringField(snapshot, "target_column_id");
    const tableId =
      (targetColumnId
        ? resolutionMaps.columnTableIds[targetColumnId]
        : undefined) ??
      (sourceColumnId
        ? resolutionMaps.columnTableIds[sourceColumnId]
        : undefined);

    return [
      ...(targetColumnId
        ? [
            changeTargetKey.column(targetColumnId),
          ]
        : []),
      ...(sourceColumnId
        ? [
            changeTargetKey.column(sourceColumnId),
          ]
        : []),
      ...(tableId
        ? [
            changeTargetKey.table(tableId),
          ]
        : []),
    ];
  }

  if (event.resource === "program") {
    return [
      changeTargetKey.program(event.entity_id),
    ];
  }

  if (event.resource === "program_version") {
    const programId = getStringField(snapshot, "program_id");

    return [
      changeTargetKey.programVersion(event.entity_id),
      ...(programId
        ? [
            changeTargetKey.program(programId),
          ]
        : []),
    ];
  }

  if (event.resource === "program_file") {
    const versionId = getStringField(snapshot, "version_id");
    const programId = versionId
      ? resolutionMaps.versionProgramIds[versionId]
      : undefined;
    const filename = getStringField(snapshot, "filename");

    return [
      ...(programId && filename
        ? [
            changeTargetKey.programFile(programId, filename),
          ]
        : []),
      ...(versionId
        ? [
            changeTargetKey.programVersion(versionId),
          ]
        : []),
      ...(programId
        ? [
            changeTargetKey.program(programId),
          ]
        : []),
    ];
  }

  if (event.resource === "program_run") {
    const versionId = getStringField(snapshot, "program_version_id");
    const programId = versionId
      ? resolutionMaps.versionProgramIds[versionId]
      : undefined;

    return [
      ...(versionId
        ? [
            changeTargetKey.programVersion(versionId),
          ]
        : []),
      ...(programId
        ? [
            changeTargetKey.program(programId),
          ]
        : []),
    ];
  }

  if (
    event.resource === "profile" ||
    event.resource === "key" ||
    event.resource === "secret"
  ) {
    return [
      changeTargetKey.profiles(),
    ];
  }

  return [];
}

function appendLimitedTargetKeys(
  targetKeys: string[],
  nextTargetKeys: string[],
) {
  for (const targetKey of nextTargetKeys) {
    if (
      targetKeys.length >= CHANGE_RADAR_TARGET_LIMIT ||
      targetKeys.includes(targetKey)
    ) {
      continue;
    }

    targetKeys.push(targetKey);
  }
}

function resolveEventDetailTargetKeys(
  event: EventRow,
  resolutionMaps: ResolutionMaps,
) {
  const snapshot = getEventSnapshot(event);

  if (
    event.resource === "project" ||
    event.resource === "table" ||
    event.resource === "row" ||
    event.resource === "column" ||
    event.resource === "program" ||
    event.resource === "program_version"
  ) {
    return resolveEventTargetKeys(event, resolutionMaps).slice(0, 1);
  }

  if (event.resource === "cell") {
    const rowId = getStringField(snapshot, "row_id");
    const columnId = getStringField(snapshot, "column_id");

    return rowId && columnId
      ? [
          changeTargetKey.cell(rowId, columnId),
        ]
      : [];
  }

  if (event.resource === "column_dependency") {
    const sourceColumnId = getStringField(snapshot, "source_column_id");
    const targetColumnId = getStringField(snapshot, "target_column_id");

    return [
      ...(targetColumnId
        ? [
            changeTargetKey.column(targetColumnId),
          ]
        : []),
      ...(sourceColumnId
        ? [
            changeTargetKey.column(sourceColumnId),
          ]
        : []),
    ];
  }

  if (event.resource === "program_file") {
    const programId = getStringField(snapshot, "program_id");
    const versionId = getStringField(snapshot, "version_id");
    const resolvedProgramId =
      programId ??
      (versionId ? resolutionMaps.versionProgramIds[versionId] : undefined);
    const filename = getStringField(snapshot, "filename");

    return resolvedProgramId && filename
      ? [
          changeTargetKey.programFile(resolvedProgramId, filename),
        ]
      : resolvedProgramId
        ? [
            changeTargetKey.program(resolvedProgramId),
          ]
        : [];
  }

  if (event.resource === "program_run") {
    const versionId = getStringField(snapshot, "program_version_id");
    const programId = versionId
      ? resolutionMaps.versionProgramIds[versionId]
      : undefined;

    return versionId
      ? [
          changeTargetKey.programVersion(versionId),
        ]
      : programId
        ? [
            changeTargetKey.program(programId),
          ]
        : [];
  }

  if (
    event.resource === "profile" ||
    event.resource === "key" ||
    event.resource === "secret"
  ) {
    return [
      changeTargetKey.profiles(),
    ];
  }

  return [];
}

function resolveRadarScope(
  event: EventRow,
  indexes: RadarIndexes,
  resolutionMaps: ResolutionMaps,
): RadarScope {
  const snapshot = getEventSnapshot(event);

  if (event.resource === "project") {
    const label =
      indexes.projects.get(event.entity_id) ??
      getStringField(snapshot, "name") ??
      "Project";

    return {
      href: `/projects/${event.entity_id}`,
      key: `project:${event.entity_id}`,
      label,
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  if (event.resource === "table") {
    const projectId = getStringField(snapshot, "project_id");

    return {
      href: buildTableHref(indexes, event.entity_id, projectId),
      key: `table:${event.entity_id}`,
      label:
        indexes.tables.get(event.entity_id)?.label ??
        getStringField(snapshot, "name") ??
        `Table ${shortId(event.entity_id)}`,
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  if (event.resource === "row" || event.resource === "column") {
    const tableId = getStringField(snapshot, "table_id");

    if (tableId) {
      return {
        href: buildTableHref(indexes, tableId),
        key: `table:${tableId}`,
        label: buildTableLabel(indexes, tableId),
        targetKeys: resolveEventTargetKeys(event, resolutionMaps),
      };
    }
  }

  if (event.resource === "cell") {
    const rowId = getStringField(snapshot, "row_id");
    const columnId = getStringField(snapshot, "column_id");
    const tableId =
      (rowId ? resolutionMaps.rowTableIds[rowId] : undefined) ??
      (columnId ? resolutionMaps.columnTableIds[columnId] : undefined);

    if (tableId) {
      return {
        href: buildTableHref(indexes, tableId),
        key: `table:${tableId}`,
        label: buildTableLabel(indexes, tableId),
        targetKeys: resolveEventTargetKeys(event, resolutionMaps),
      };
    }
  }

  if (event.resource === "column_dependency") {
    const sourceColumnId = getStringField(snapshot, "source_column_id");
    const targetColumnId = getStringField(snapshot, "target_column_id");
    const tableId =
      (targetColumnId
        ? resolutionMaps.columnTableIds[targetColumnId]
        : undefined) ??
      (sourceColumnId
        ? resolutionMaps.columnTableIds[sourceColumnId]
        : undefined);

    if (tableId) {
      return {
        href: buildTableHref(indexes, tableId),
        key: `table:${tableId}`,
        label: buildTableLabel(indexes, tableId),
        targetKeys: resolveEventTargetKeys(event, resolutionMaps),
      };
    }
  }

  if (event.resource === "program") {
    const label =
      indexes.programs.get(event.entity_id) ??
      getStringField(snapshot, "name") ??
      "Program";

    return {
      href: buildProgramHref(event.entity_id),
      key: `program:${event.entity_id}`,
      label,
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  if (event.resource === "program_version") {
    const programId = getStringField(snapshot, "program_id");

    return {
      href: buildProgramHref(programId),
      key: `program:${programId ?? event.entity_id}`,
      label:
        (programId ? indexes.programs.get(programId) : undefined) ?? "Program",
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  if (event.resource === "program_file" || event.resource === "program_run") {
    const versionId =
      getStringField(snapshot, "version_id") ??
      getStringField(snapshot, "program_version_id");
    const programId = versionId
      ? resolutionMaps.versionProgramIds[versionId]
      : undefined;

    return {
      href: buildProgramHref(programId ?? undefined),
      key: `program:${programId ?? versionId ?? event.entity_id}`,
      label:
        (programId ? indexes.programs.get(programId) : undefined) ?? "Program",
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  if (
    event.resource === "profile" ||
    event.resource === "key" ||
    event.resource === "secret"
  ) {
    return {
      href: "/profiles",
      key: "profiles",
      label: "Profiles",
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  return {
    href: "/events",
    key: `events:${event.resource}:${event.entity_id}`,
    label: titleCase(event.resource),
    targetKeys: resolveEventTargetKeys(event, resolutionMaps),
  };
}

function buildRadarSegments(
  operationCounts: Record<EventOperation, number>,
): MarbleActivityRadarSegment[] {
  return [
    operationCounts.Create > 0
      ? {
          tone: "create",
          value: operationCounts.Create,
        }
      : null,
    operationCounts.Update > 0
      ? {
          tone: "update",
          value: operationCounts.Update,
        }
      : null,
    operationCounts.Delete > 0
      ? {
          tone: "delete",
          value: operationCounts.Delete,
        }
      : null,
  ].filter(
    (segment): segment is MarbleActivityRadarSegment => segment !== null,
  );
}

function buildBatchDescription(detailItems: MarbleReviewNavigatorDetailItem[]) {
  return detailItems
    .map((item) =>
      [
        item.label,
        ...(item.diffs ?? []).map((diff) =>
          diff.tone === "create"
            ? `+${diff.count}`
            : diff.tone === "delete"
              ? `-${diff.count}`
              : `~${diff.count}`,
        ),
      ].join(" "),
    )
    .filter((part) => part.length > 0)
    .join(" · ");
}

function buildBatchDetailItems(
  counts: Map<string, number>,
  burstCount: number,
  resourceTargetKeys: Map<string, string[]>,
  resourceOperationTargetKeys: Map<string, string[]>,
  targetKeys: string[],
): MarbleReviewNavigatorDetailItem[] {
  const resourceTotals = new Map<
    string,
    {
      count: number;
      operations: Record<"Create" | "Delete" | "Update", number>;
    }
  >();

  for (const [key, count] of counts) {
    const [resource, operation] = key.split(":");

    if (
      !resource ||
      (operation !== "Create" &&
        operation !== "Delete" &&
        operation !== "Update")
    ) {
      continue;
    }

    const current = resourceTotals.get(resource) ?? {
      count: 0,
      operations: {
        Create: 0,
        Delete: 0,
        Update: 0,
      },
    };

    current.count += count;
    current.operations[operation] += count;
    resourceTotals.set(resource, current);
  }

  const resourceItems = Array.from(resourceTotals.entries())
    .map(([resource, value]) => ({
      diffs: [
        value.operations.Create > 0
          ? {
              count: value.operations.Create,
              targetKeys: resourceOperationTargetKeys.get(`${resource}:Create`),
              tone: "create" as const,
            }
          : null,
        value.operations.Update > 0
          ? {
              count: value.operations.Update,
              targetKeys: resourceOperationTargetKeys.get(`${resource}:Update`),
              tone: "update" as const,
            }
          : null,
        value.operations.Delete > 0
          ? {
              count: value.operations.Delete,
              targetKeys: resourceOperationTargetKeys.get(`${resource}:Delete`),
              tone: "delete" as const,
            }
          : null,
      ].filter((diff): diff is NonNullable<typeof diff> => diff !== null),
      label: pluralize(titleCase(resource).toLowerCase(), value.count),
      targetKeys: resourceTargetKeys.get(resource),
      total: value.count,
    }))
    .sort(
      (left, right) =>
        right.total - left.total || left.label.localeCompare(right.label),
    )
    .slice(0, 2)
    .map(({ diffs, label, targetKeys: resourceItemTargetKeys }) => ({
      diffs,
      label,
      targetKeys: resourceItemTargetKeys,
    }));

  return [
    ...(burstCount > 1
      ? [
          {
            label: `${burstCount} waves`,
            targetKeys,
          } satisfies MarbleReviewNavigatorDetailItem,
        ]
      : []),
    ...resourceItems,
  ];
}

function buildRadarBatches(
  events: EventRow[],
  indexes: RadarIndexes,
  resolutionMaps: ResolutionMaps,
  lastReviewedAt: null | string,
) {
  const grouped = new Map<
    string,
    {
      actorProfileIds: string[];
      burstKeys: Set<string>;
      counts: Map<string, number>;
      href: string;
      id: string;
      label: string;
      latestAt: string;
      operations: Record<EventOperation, number>;
      resourceOperationTargetKeys: Map<string, string[]>;
      resourceTargetKeys: Map<string, string[]>;
      targetKeys: string[];
      unread: boolean;
    }
  >();

  for (const event of events
    .filter((candidate) => candidate.operation !== "Read")
    .sort((left, right) => right.created_at.localeCompare(left.created_at))) {
    const scope = resolveRadarScope(event, indexes, resolutionMaps);
    const bucketKey = event.request_id
      ? `request:${event.request_id}`
      : `time:${Math.floor(
          new Date(event.created_at).getTime() / CHANGE_RADAR_BUCKET_MS,
        )}`;
    const groupId = scope.key;
    const summaryKey = `${event.resource}:${event.operation}`;

    if (!grouped.has(groupId)) {
      grouped.set(groupId, {
        actorProfileIds: [
          event.actor_profile_id,
        ],
        burstKeys: new Set(),
        counts: new Map(),
        href: scope.href,
        id: groupId,
        label: scope.label,
        latestAt: event.created_at,
        operations: {
          Create: 0,
          Delete: 0,
          Read: 0,
          Update: 0,
        },
        resourceOperationTargetKeys: new Map(),
        resourceTargetKeys: new Map(),
        targetKeys: [
          ...scope.targetKeys,
        ].slice(0, CHANGE_RADAR_TARGET_LIMIT),
        unread:
          lastReviewedAt === null ||
          event.created_at.localeCompare(lastReviewedAt) > 0,
      });
    }

    const current = grouped.get(groupId);
    const detailTargetKeys = resolveEventDetailTargetKeys(
      event,
      resolutionMaps,
    );

    if (!current) {
      continue;
    }

    current.counts.set(summaryKey, (current.counts.get(summaryKey) ?? 0) + 1);
    current.burstKeys.add(bucketKey);
    current.operations[event.operation] += 1;
    current.unread =
      current.unread ||
      lastReviewedAt === null ||
      event.created_at.localeCompare(lastReviewedAt) > 0;
    appendLimitedTargetKeys(current.targetKeys, scope.targetKeys);

    const resourceTargetKeys =
      current.resourceTargetKeys.get(event.resource) ?? [];
    appendLimitedTargetKeys(resourceTargetKeys, detailTargetKeys);
    current.resourceTargetKeys.set(event.resource, resourceTargetKeys);

    const resourceOperationTargetKeys =
      current.resourceOperationTargetKeys.get(summaryKey) ?? [];
    appendLimitedTargetKeys(resourceOperationTargetKeys, detailTargetKeys);
    current.resourceOperationTargetKeys.set(
      summaryKey,
      resourceOperationTargetKeys,
    );

    if (!current.actorProfileIds.includes(event.actor_profile_id)) {
      current.actorProfileIds.push(event.actor_profile_id);
    }

    if (event.created_at.localeCompare(current.latestAt) > 0) {
      current.latestAt = event.created_at;
    }
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.latestAt.localeCompare(left.latestAt))
    .slice(0, 6)
    .map((batch): RadarBatchRecord => {
      const detailItems = buildBatchDetailItems(
        batch.counts,
        batch.burstKeys.size,
        batch.resourceTargetKeys,
        batch.resourceOperationTargetKeys,
        batch.targetKeys,
      );

      return {
        actors: batch.actorProfileIds
          .map(
            (profileId) =>
              indexes.profiles.get(profileId) ?? {
                id: profileId,
                name: `Profile ${shortId(profileId)}`,
                type: "Agent" as const,
              },
          )
          .slice(0, 3),
        burstCount: batch.burstKeys.size,
        description: buildBatchDescription(detailItems),
        detailItems,
        href: batch.href,
        id: batch.id,
        label: batch.label,
        latestAt: batch.latestAt,
        segments: buildRadarSegments(batch.operations),
        targetKeys: batch.targetKeys,
        unread: batch.unread,
      };
    });
}

function upsertRadarEvent(current: EventRow[], nextEvent: EventRow) {
  return [
    nextEvent,
    ...current.filter((event) => event.id !== nextEvent.id),
  ]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, CHANGE_RADAR_EVENT_LIMIT);
}

export function ChangeRadar({
  className,
  compact = true,
  sidebarData,
}: ChangeRadarProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [events, setEvents] = useState<EventRow[]>([]);
  const [lastReviewedAt, setLastReviewedAt] = useState<null | string>(null);
  const [resolutionMaps, setResolutionMaps] = useState<ResolutionMaps>({
    columnTableIds: {},
    rowTableIds: {},
    versionProgramIds: {},
  });
  const ownedProfileIds = sidebarData.ownerProfileIds;
  const ownedProfileIdsKey = ownedProfileIds.join(":");
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
    const ownedProfileIdSet = new Set(ownedProfileIds);

    void supabase
      .from("event")
      .select("*")
      .in("actor_profile_id", ownedProfileIds)
      .neq("source", "WEB_APP")
      .order("created_at", {
        ascending: false,
      })
      .limit(CHANGE_RADAR_EVENT_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        if (error) {
          console.error("Change radar bootstrap failed", error);
          return;
        }

        setEvents(
          ((data ?? []) as EventRow[]).filter(
            (event) => event.operation !== "Read",
          ),
        );
      });

    const channel = supabase
      .channel(`change-radar:${ownedProfileIdsKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event",
        },
        (payload) => {
          const change = payload as RealtimePayload<EventRow>;
          const candidate =
            change.eventType === "DELETE" ? change.old : change.new;

          if (
            typeof candidate.id !== "string" ||
            typeof candidate.actor_profile_id !== "string" ||
            !ownedProfileIdSet.has(candidate.actor_profile_id) ||
            candidate.source === "WEB_APP" ||
            candidate.operation === "Read"
          ) {
            return;
          }

          setEvents((current) =>
            change.eventType === "DELETE"
              ? current.filter((event) => event.id !== candidate.id)
              : upsertRadarEvent(current, change.new as EventRow),
          );
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || error) {
          console.error("Change radar realtime channel failed", error);
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [
    ownedProfileIds,
    ownedProfileIdsKey,
    supabase,
  ]);

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

    void Promise.all([
      pendingRows.size > 0
        ? supabase
            .from("row")
            .select("id, table_id")
            .in("id", Array.from(pendingRows))
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              table_id: string;
            }>,
            error: null,
          }),
      pendingColumns.size > 0
        ? supabase
            .from("column")
            .select("id, table_id")
            .in("id", Array.from(pendingColumns))
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              table_id: string;
            }>,
            error: null,
          }),
      pendingVersions.size > 0
        ? supabase
            .from("program_version")
            .select("id, program_id")
            .in("id", Array.from(pendingVersions))
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              program_id: string;
            }>,
            error: null,
          }),
    ]).then(([rowsResult, columnsResult, versionsResult]) => {
      if (cancelled) {
        return;
      }

      if (rowsResult.error || columnsResult.error || versionsResult.error) {
        console.error(
          "Change radar resolution failed",
          rowsResult.error ?? columnsResult.error ?? versionsResult.error,
        );
        return;
      }

      setResolutionMaps((current) => ({
        columnTableIds: {
          ...current.columnTableIds,
          ...Object.fromEntries(
            Array.from(pendingColumns).map((id) => [
              id,
              (columnsResult.data ?? []).find((column) => column.id === id)
                ?.table_id ?? null,
            ]),
          ),
        },
        rowTableIds: {
          ...current.rowTableIds,
          ...Object.fromEntries(
            Array.from(pendingRows).map((id) => [
              id,
              (rowsResult.data ?? []).find((row) => row.id === id)?.table_id ??
                null,
            ]),
          ),
        },
        versionProgramIds: {
          ...current.versionProgramIds,
          ...Object.fromEntries(
            Array.from(pendingVersions).map((id) => [
              id,
              (versionsResult.data ?? []).find((version) => version.id === id)
                ?.program_id ?? null,
            ]),
          ),
        },
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [
    events,
    resolutionMaps,
    supabase,
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

  return (
    <MarbleActivityRadar
      batches={batches}
      className={className}
      compact={compact}
      onMarkAllRead={() =>
        markReviewedThrough(batchRecords[0]?.latestAt ?? null)
      }
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          clearPreviewChangeSpotlight();
        }
      }}
      unreadCount={unreadCount}
    />
  );
}
