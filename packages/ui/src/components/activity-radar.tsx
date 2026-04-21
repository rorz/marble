"use client";
import { cx } from "../utils/cx";
import { MarbleBadge } from "./badge";
import {
  MarbleContextPopover,
  type MarbleContextPopoverSection,
} from "./context-popover";
import {
  MarbleProfileAttribution,
  type MarbleProfileAttributionProfile,
} from "./profile-attribution";

type MarbleActivityRadarSegmentTone =
  | "create"
  | "delete"
  | "neutral"
  | "update";

export type MarbleActivityRadarSegment = {
  tone: MarbleActivityRadarSegmentTone;
  value: number;
};

export type MarbleActivityRadarBatch = {
  actors?: MarbleProfileAttributionProfile[];
  description: string;
  id: string;
  label: string;
  onPreviewEnd?: () => void;
  onPreviewStart?: () => void;
  onSelect: () => void;
  segments: MarbleActivityRadarSegment[];
  timestampLabel?: string;
  unread?: boolean;
};

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

const SEGMENT_TONE_CLASS_NAMES: Record<MarbleActivityRadarSegmentTone, string> =
  {
    create: "bg-emerald-500",
    delete: "bg-red-500",
    neutral: "bg-taupe-300",
    update: "bg-amber-500",
  };

function getSegmentTotal(segments: MarbleActivityRadarSegment[]) {
  return segments.reduce((total, segment) => total + segment.value, 0);
}

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

function ActivityMeter({
  className,
  segments,
}: {
  className?: string;
  segments: MarbleActivityRadarSegment[];
}) {
  const filteredSegments = segments.filter((segment) => segment.value > 0);
  const total = getSegmentTotal(filteredSegments);
  const resolvedSegments: MarbleActivityRadarSegment[] =
    filteredSegments.length > 0
      ? filteredSegments
      : [
          {
            tone: "neutral",
            value: 1,
          },
        ];
  const resolvedTotal = total > 0 ? total : 1;

  return (
    <div
      className={cx(
        "flex h-2.5 w-full min-w-0 overflow-hidden rounded-full border border-taupe-200/80 bg-white/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]",
        className,
      )}
    >
      {resolvedSegments.map((segment) => (
        <div
          className={cx(
            "h-full shrink-0",
            SEGMENT_TONE_CLASS_NAMES[segment.tone],
          )}
          key={`${segment.tone}:${segment.value}`}
          style={{
            width: `${(segment.value / resolvedTotal) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

function ActivityGlyph({
  pulse = false,
  segments,
}: {
  pulse?: boolean;
  segments: MarbleActivityRadarSegment[];
}) {
  return (
    <div className="relative flex size-8 shrink-0 items-center justify-center">
      <div
        className={cx(
          "absolute inset-0 rounded-full bg-orange-200/60 blur-[10px] transition-opacity duration-200",
          pulse ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="relative flex size-8 items-center justify-center rounded-xs border border-taupe-200/90 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
        <div className="flex w-4 flex-col gap-[2px]">
          <ActivityMeter
            className="h-[3px] rounded-[999px] border-0 bg-transparent shadow-none"
            segments={segments}
          />
          <ActivityMeter
            className="h-[3px] rounded-[999px] border-0 bg-transparent shadow-none"
            segments={[
              ...segments.slice(1),
              ...segments.slice(0, 1),
            ]}
          />
          <ActivityMeter
            className="h-[3px] rounded-[999px] border-0 bg-transparent shadow-none"
            segments={[
              ...segments.slice(2),
              ...segments.slice(0, 2),
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function formatUnreadCount(value: number) {
  if (value > 99) {
    return "99+";
  }

  return String(value);
}

function ActivityUnreadBadge({ count }: { count: number }) {
  return (
    <MarbleBadge
      aria-label={`${count} unread changesets`}
      className="pointer-events-none absolute -right-1.5 -top-1.5 min-h-5 min-w-5 items-center justify-center rounded-full border-white bg-orange-500 px-1.5 py-0 text-center font-mono text-[10px] leading-[18px] text-white shadow-[0_6px_16px_rgba(84,57,26,0.18)]"
    >
      {formatUnreadCount(count)}
    </MarbleBadge>
  );
}

function CaretDownGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path
        d="M4.25 6.5 8 10.25 11.75 6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
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
  const unreadBatches = batches.filter((batch) => batch.unread);
  const reviewedBatches = batches.filter((batch) => !batch.unread);
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
  const hasUnread = unreadCount > 0;
  const sections: MarbleContextPopoverSection[] = [];
  const changedPlaceLabel = pluralize("place", unreadCount || batches.length);

  const buildBatchItem = (batch: MarbleActivityRadarBatch) => ({
    description:
      batch.actors && batch.actors.length > 0 ? (
        <div className="space-y-1">
          <MarbleProfileAttribution profiles={batch.actors} />
          <div className="truncate text-xs text-zinc-500">
            {batch.description}
          </div>
        </div>
      ) : (
        batch.description
      ),
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
      triggerClassName={cx(
        compact
          ? "size-9 rounded-xs bg-transparent p-1 text-taupe-700 hover:bg-taupe-200/80 hover:text-taupe-900"
          : "w-full justify-start rounded-xs bg-transparent px-2.5 py-1.5 text-taupe-700 hover:bg-taupe-200/80 hover:text-taupe-900",
        triggerClassName,
      )}
    >
      <div
        className={cx(
          "flex min-w-0 items-center",
          compact ? "justify-center" : "gap-2.5",
        )}
      >
        <div className="relative">
          <ActivityGlyph
            pulse={hasUnread}
            segments={headerSegments}
          />
          {hasUnread ? <ActivityUnreadBadge count={unreadCount} /> : null}
        </div>
        {compact ? null : (
          <>
            <div className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate font-medium text-sm text-taupe-900 tracking-tight">
                Agent changesets
              </span>
              <span className="truncate text-[11px] text-taupe-500">
                {hasUnread ? `${unreadCount} unreviewed` : "No pending review"}
              </span>
            </div>
            <CaretDownGlyph className="ml-auto size-4 shrink-0 text-taupe-400" />
          </>
        )}
      </div>
    </MarbleContextPopover>
  );
}
