"use client";
import { cx } from "../../utils/cx";
import {
  MarbleContextPopover,
  type MarbleContextPopoverSection,
} from "../context-popover";
import {
  ActivityBatchDescription,
  ActivityGlyph,
  ActivityMeter,
  type MarbleActivityRadarBatch,
  type MarbleActivityRadarSegmentTone,
} from "./glyph";
import { MarbleActivityRadarTrigger } from "./trigger";

export type {
  MarbleActivityRadarBatch,
  MarbleActivityRadarSegment,
} from "./glyph";
export {
  MarbleActivityRadarPanel,
  type MarbleActivityRadarPanelProps,
} from "./panel";
export {
  MarbleActivityRadarTrigger,
  type MarbleActivityRadarTriggerProps,
} from "./trigger";

export type MarbleActivityRadarProps = {
  batches: MarbleActivityRadarBatch[];
  className?: string;
  compact?: boolean;
  emptyDescription?: string;
  onMarkAllRead?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
  onOpenFeed?: () => void;
  triggerClassName?: string;
  unreadCount?: number;
};

function pluralize(label: string, count: number) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function summarizeSegments(batches: MarbleActivityRadarBatch[]) {
  const segmentTotals = {
    create: 0,
    delete: 0,
    neutral: 0,
    update: 0,
  } satisfies Record<MarbleActivityRadarSegmentTone, number>;

  for (const batch of batches) {
    for (const segment of batch.segments) {
      segmentTotals[segment.tone] += segment.value;
    }
  }

  return (
    [
      "create",
      "update",
      "delete",
      "neutral",
    ] as const
  )
    .map((tone) => ({
      tone,
      value: segmentTotals[tone],
    }))
    .filter((segment) => segment.value > 0);
}

export function getRadarSummary(
  batches: MarbleActivityRadarBatch[],
  unreadCount: number,
) {
  const unreadBatches = batches.filter((batch) => batch.unread);
  const reviewedBatches = batches.filter((batch) => !batch.unread);

  return {
    changedPlaceLabel: pluralize("place", unreadCount || batches.length),
    hasUnread: unreadCount > 0,
    headerSegments: summarizeSegments(batches),
    reviewedBatches,
    unreadBatches,
  };
}

export function MarbleActivityRadar({
  batches,
  className,
  compact = false,
  emptyDescription = "No recent agent changes.",
  onMarkAllRead,
  onOpenChange,
  onOpenFeed,
  triggerClassName,
  unreadCount = 0,
}: MarbleActivityRadarProps) {
  const { changedPlaceLabel, hasUnread, unreadBatches, reviewedBatches } =
    getRadarSummary(batches, unreadCount);
  const visibleUnreadBatches = unreadBatches.slice(0, 4);
  const remainingVisibleSlots = Math.max(0, 6 - visibleUnreadBatches.length);
  const visibleReviewedBatches = reviewedBatches.slice(
    0,
    remainingVisibleSlots,
  );
  const visibleBatches = [
    ...visibleUnreadBatches,
    ...visibleReviewedBatches,
  ];
  const headerSegments = summarizeSegments(visibleBatches);
  const sections: MarbleContextPopoverSection[] = [];

  const buildBatchItem = (batch: MarbleActivityRadarBatch) => ({
    description: <ActivityBatchDescription batch={batch} />,
    detail: (
      <div className="flex min-w-[3.5rem] flex-col items-end gap-1">
        <span
          className={cx(
            "font-medium text-[11px]",
            batch.unread ? "text-orange-700" : "text-taupe-500",
          )}
        >
          {batch.unread ? "New" : batch.timestampLabel}
        </span>
        <div className="w-10">
          <ActivityMeter
            className="h-1.5 rounded-full border-taupe-200/80 bg-taupe-100 shadow-none"
            segments={batch.segments}
          />
        </div>
      </div>
    ),
    id: batch.id,
    label: batch.label,
    onBlur: batch.onPreviewEnd,
    onFocus: batch.onPreviewStart,
    onPointerEnter: batch.onPreviewStart,
    onPointerLeave: batch.onPreviewEnd,
    onSelect: batch.onSelect,
  });

  if (visibleUnreadBatches.length > 0) {
    sections.push({
      id: "activity-new",
      items: visibleUnreadBatches.map(buildBatchItem),
      label: "New",
    });
  }

  if (visibleReviewedBatches.length > 0) {
    sections.push({
      id: "activity-earlier",
      items: visibleReviewedBatches.map(buildBatchItem),
      label: visibleUnreadBatches.length > 0 ? "Earlier" : "Recent",
    });
  }

  if ((onOpenFeed && batches.length > 0) || (onMarkAllRead && hasUnread)) {
    sections.push({
      id: "activity-actions",
      items: [
        ...(onOpenFeed
          ? [
              {
                label: "Open events",
                onSelect: onOpenFeed,
              },
            ]
          : []),
        ...(onMarkAllRead
          ? [
              {
                label: "Mark visible reviewed",
                onSelect: onMarkAllRead,
              },
            ]
          : []),
      ],
      label: "Actions",
    });
  }

  return (
    <MarbleContextPopover
      align="start"
      ariaLabel="Open agent changesets"
      asChild
      className={className}
      header={
        <div className="flex items-center gap-3 px-2 py-1.5">
          <ActivityGlyph
            pulse={hasUnread}
            segments={headerSegments}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="font-semibold text-sm text-taupe-950">
              Agent changesets
            </div>
            <span className="text-xs text-taupe-600">
              {batches.length > 0
                ? hasUnread
                  ? `${changedPlaceLabel} need review.`
                  : `${changedPlaceLabel} changed recently.`
                : emptyDescription}
            </span>
          </div>
          {headerSegments.length > 0 ? (
            <div className="w-12 shrink-0">
              <ActivityMeter
                className="h-1.5 rounded-full border-taupe-200/80 bg-taupe-100 shadow-none"
                segments={headerSegments}
              />
            </div>
          ) : null}
        </div>
      }
      menuClassName="min-w-[22rem] max-w-[26rem] rounded-xs border border-orange-200/80 bg-white p-2 shadow-[0_18px_40px_rgba(84,57,26,0.12)]"
      onOpenChange={onOpenChange}
      sections={sections}
    >
      <MarbleActivityRadarTrigger
        batches={batches}
        className={triggerClassName}
        compact={compact}
        unreadCount={unreadCount}
      />
    </MarbleContextPopover>
  );
}
