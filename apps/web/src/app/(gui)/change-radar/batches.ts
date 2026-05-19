import { byString, composeCompare } from "@marble/lib/compare";
import type {
  MarbleActivityRadarSegment,
  MarbleProfileAttributionProfile,
  MarbleReviewNavigatorDetailItem,
} from "@marble/ui";
import { CHANGE_RADAR_BUCKET_MS, CHANGE_RADAR_TARGET_LIMIT } from "./constants";
import type { EventOperation, EventRow } from "./event-snapshot";
import { pluralize, shortId, titleCase } from "./event-snapshot";
import type { RadarIndexes, ResolutionMaps } from "./indexes";
import { resolveRadarScope } from "./scope";
import {
  appendLimitedTargetKeys,
  resolveEventDetailTargetKeys,
} from "./target-keys";

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

const buildRadarSegments = (
  operationCounts: Record<EventOperation, number>,
): MarbleActivityRadarSegment[] => {
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
};

const buildBatchDescription = (
  detailItems: MarbleReviewNavigatorDetailItem[],
) => {
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
};

const buildBatchDetailItems = (
  counts: Map<string, number>,
  burstCount: number,
  resourceTargetKeys: Map<string, string[]>,
  resourceOperationTargetKeys: Map<string, string[]>,
  targetKeys: string[],
): MarbleReviewNavigatorDetailItem[] => {
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
      composeCompare(
        (left, right) => right.total - left.total,
        byString((entry) => entry.label),
      ),
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
};

export const buildRadarBatches = (
  events: EventRow[],
  indexes: RadarIndexes,
  resolutionMaps: ResolutionMaps,
  lastReviewedAt: null | string,
) => {
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
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))) {
    const scope = resolveRadarScope(event, indexes, resolutionMaps);
    const bucketKey = event.requestId
      ? `request:${event.requestId}`
      : `time:${Math.floor(
          new Date(event.createdAt).getTime() / CHANGE_RADAR_BUCKET_MS,
        )}`;
    const groupId = scope.key;
    const summaryKey = `${event.resource}:${event.operation}`;

    if (!grouped.has(groupId)) {
      grouped.set(groupId, {
        actorProfileIds: [
          event.actorProfileId,
        ],
        burstKeys: new Set(),
        counts: new Map(),
        href: scope.href,
        id: groupId,
        label: scope.label,
        latestAt: event.createdAt,
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
          event.createdAt.localeCompare(lastReviewedAt) > 0,
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
      event.createdAt.localeCompare(lastReviewedAt) > 0;
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

    if (!current.actorProfileIds.includes(event.actorProfileId)) {
      current.actorProfileIds.push(event.actorProfileId);
    }

    if (event.createdAt.localeCompare(current.latestAt) > 0) {
      current.latestAt = event.createdAt;
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
};
