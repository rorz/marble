"use client";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";
import { MarbleBadge } from "./badge";
import {
  MarbleContextPopover,
  type MarbleContextPopoverSection,
} from "./context-popover";
import { MarbleListRow } from "./list-row";
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

export type MarbleActivityRadarTriggerProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  batches: MarbleActivityRadarBatch[];
  compact?: boolean;
  slim?: boolean;
  unreadCount?: number;
};

export type MarbleActivityRadarPanelProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  batches: MarbleActivityRadarBatch[];
  emptyDescription?: string;
  onMarkAllRead?: () => void;
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

function getRadarSummary(
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
      <div className="relative flex size-8 items-center justify-center rounded-xs border border-taupe-200/90 bg-white shadow-marble-highlight-strong">
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

function ActivityBatchDescription({
  batch,
}: {
  batch: MarbleActivityRadarBatch;
}) {
  return batch.actors && batch.actors.length > 0 ? (
    <div className="space-y-1">
      <MarbleProfileAttribution profiles={batch.actors} />
      <div className="line-clamp-2 text-xs text-taupe-600">
        {batch.description}
      </div>
    </div>
  ) : (
    <div className="line-clamp-2 text-xs text-taupe-600">
      {batch.description}
    </div>
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

export function MarbleActivityRadarTrigger({
  batches,
  className,
  compact = false,
  slim = false,
  type = "button",
  unreadCount = 0,
  ...props
}: MarbleActivityRadarTriggerProps) {
  const { hasUnread, headerSegments } = getRadarSummary(batches, unreadCount);

  if (slim) {
    return (
      <button
        className={cx(
          "relative flex size-6 items-center justify-center rounded-full bg-transparent text-taupe-500 transition-colors hover:bg-taupe-200/80 hover:text-taupe-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300",
          className,
        )}
        type={type}
        {...props}
      >
        <span
          className={cx(
            "pointer-events-none absolute rounded-full transition-all duration-200",
            hasUnread
              ? "size-4 bg-orange-200/70 blur-[6px]"
              : "size-3 bg-taupe-300/70 blur-[4px]",
          )}
        />
        <span
          className={cx(
            "relative block rounded-full transition-colors",
            hasUnread ? "size-2 bg-orange-500" : "size-1.5 bg-taupe-500",
          )}
        />
      </button>
    );
  }

  return (
    <button
      className={cx(
        compact
          ? "size-9 rounded-xs bg-transparent p-1 text-taupe-700 hover:bg-taupe-200/80 hover:text-taupe-900"
          : "flex w-full justify-start rounded-xs bg-transparent px-2.5 py-1.5 text-taupe-700 hover:bg-taupe-200/80 hover:text-taupe-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300",
        className,
      )}
      type={type}
      {...props}
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
    </button>
  );
}

function ActivityRadarPanelSection({
  batches,
  label,
}: {
  batches: MarbleActivityRadarBatch[];
  label: string;
}) {
  if (batches.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <div className="px-1 font-medium text-eyebrow-xs text-taupe-500">
        {label}
      </div>

      <div className="overflow-hidden rounded-sm border border-taupe-200/80 bg-white/92">
        {batches.map((batch) => (
          <MarbleListRow
            align="start"
            aside={
              <div className="w-12">
                <ActivityMeter
                  className="h-1.5 rounded-full border-taupe-200/80 bg-taupe-100 shadow-none"
                  segments={batch.segments}
                />
              </div>
            }
            className={cx(
              "min-h-20 bg-transparent",
              batch.unread ? "bg-orange-50/60" : null,
            )}
            description={<ActivityBatchDescription batch={batch} />}
            icon={
              <ActivityGlyph
                pulse={batch.unread}
                segments={batch.segments}
              />
            }
            key={batch.id}
            meta={
              <span
                className={cx(
                  "font-medium text-[11px]",
                  batch.unread ? "text-orange-700" : "text-taupe-500",
                )}
              >
                {batch.unread ? "New" : (batch.timestampLabel ?? "Earlier")}
              </span>
            }
            onBlur={batch.onPreviewEnd}
            onClick={batch.onSelect}
            onFocus={batch.onPreviewStart}
            onPointerEnter={batch.onPreviewStart}
            onPointerLeave={batch.onPreviewEnd}
            size="sm"
            title={batch.label}
            tone="orange"
            wrapperClassName="border-taupe-200/80"
          />
        ))}
      </div>
    </section>
  );
}

export function MarbleActivityRadarPanel({
  actions,
  batches,
  className,
  emptyDescription = "No recent agent changes.",
  onMarkAllRead,
  unreadCount = 0,
  ...props
}: MarbleActivityRadarPanelProps) {
  const {
    changedPlaceLabel,
    hasUnread,
    headerSegments,
    reviewedBatches,
    unreadBatches,
  } = getRadarSummary(batches, unreadCount);
  const hasActions = Boolean((hasUnread && onMarkAllRead) || actions);
  const reviewedSectionLabel = unreadBatches.length > 0 ? "Earlier" : "Recent";

  return (
    <div
      className={cx(
        "flex min-h-0 flex-col overflow-hidden rounded-sm border border-taupe-300/80 bg-[linear-gradient(180deg,rgba(248,245,238,0.96)_0%,rgba(255,255,255,0.96)_100%)] text-taupe-900 shadow-[0_12px_24px_rgba(84,57,26,0.08)]",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3 border-b border-taupe-300/80 bg-linear-to-r from-taupe-100/95 via-white/90 to-white/70 px-3 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative">
            <ActivityGlyph
              pulse={hasUnread}
              segments={headerSegments}
            />
            {hasUnread ? <ActivityUnreadBadge count={unreadCount} /> : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-sm text-taupe-950">
              Agent changesets
            </div>
            <p className="mt-0.5 text-xs text-taupe-600">
              {batches.length > 0
                ? hasUnread
                  ? `${changedPlaceLabel} need review.`
                  : `${changedPlaceLabel} changed recently.`
                : emptyDescription}
            </p>
          </div>
        </div>

        {hasActions ? (
          <div className="flex shrink-0 items-center gap-2">
            {hasUnread && onMarkAllRead ? (
              <button
                className="rounded-xs px-2 py-1 font-medium text-[11px] text-orange-700 transition-colors hover:bg-orange-50 hover:text-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                onClick={onMarkAllRead}
                type="button"
              >
                Mark all reviewed
              </button>
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>

      {headerSegments.length > 0 ? (
        <div className="border-b border-taupe-200/80 px-3 py-2">
          <ActivityMeter
            className="h-1.5 rounded-full border-taupe-200/80 bg-taupe-100 shadow-none"
            segments={headerSegments}
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {batches.length > 0 ? (
          <div className="space-y-3">
            <ActivityRadarPanelSection
              batches={unreadBatches}
              label="New"
            />
            <ActivityRadarPanelSection
              batches={reviewedBatches}
              label={reviewedSectionLabel}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-taupe-500">
            {emptyDescription}
          </div>
        )}
      </div>
    </div>
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
