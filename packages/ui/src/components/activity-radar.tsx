"use client";

import type { ReactNode } from "react";
import { cx } from "../utils/cx";
import {
  MarbleContextPopover,
  type MarbleContextPopoverSection,
} from "./context-popover";

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
  description: string;
  id: string;
  label: string;
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

function UnreadPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.18em]",
        tone === "warning"
          ? "border-orange-200 bg-orange-50 text-orange-700"
          : "border-taupe-200 bg-taupe-100 text-taupe-700",
      )}
    >
      {children}
    </span>
  );
}

export function MarbleActivityRadar({
  batches,
  className,
  compact = false,
  emptyDescription = "No recent agentic changes.",
  onMarkAllRead,
  onOpenFeed,
  triggerClassName,
  unreadCount = 0,
}: MarbleActivityRadarProps) {
  const headerSegments = summarizeSegments(batches.slice(0, 6));
  const hasUnread = unreadCount > 0;
  const sections: MarbleContextPopoverSection[] = [];

  if (batches.length > 0) {
    sections.push({
      id: "activity-batches",
      items: batches.slice(0, 8).map((batch) => ({
        description: batch.description,
        detail: (
          <div className="flex min-w-[4.75rem] items-center justify-end gap-2">
            {batch.unread ? (
              <UnreadPill tone="warning">New</UnreadPill>
            ) : batch.timestampLabel ? (
              <span className="font-medium text-[10px] uppercase tracking-[0.18em] text-taupe-500">
                {batch.timestampLabel}
              </span>
            ) : null}
            <div className="w-12">
              <ActivityMeter segments={batch.segments} />
            </div>
          </div>
        ),
        icon: (
          <span
            className={cx(
              "size-2.5 rounded-full",
              batch.unread ? "bg-orange-500" : "bg-taupe-300",
            )}
          />
        ),
        id: batch.id,
        label: batch.label,
        onSelect: batch.onSelect,
      })),
    });
  }

  if (onOpenFeed || onMarkAllRead) {
    sections.push({
      id: "activity-actions",
      items: [
        ...(onOpenFeed
          ? [
              {
                description: "Inspect the full event feed.",
                label: "Open events",
                onSelect: onOpenFeed,
              },
            ]
          : []),
        ...(onMarkAllRead
          ? [
              {
                description: "Dismiss all currently visible bursts.",
                label: "Mark visible as reviewed",
                onSelect: onMarkAllRead,
              },
            ]
          : []),
      ],
    });
  }

  return (
    <MarbleContextPopover
      align="start"
      ariaLabel="Open change radar"
      className={className}
      header={
        <div className="flex items-start gap-3 rounded-xs border border-orange-200/70 bg-orange-50/40 px-3 py-3">
          <ActivityGlyph
            pulse={hasUnread}
            segments={headerSegments}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-taupe-950">
                Change radar
              </span>
              <UnreadPill tone={hasUnread ? "warning" : "neutral"}>
                {hasUnread ? `${unreadCount} unread` : "Quiet"}
              </UnreadPill>
            </div>
            <span className="text-xs text-taupe-600">
              {batches.length > 0
                ? "Live agentic bursts grouped into compact review items."
                : emptyDescription}
            </span>
          </div>
        </div>
      }
      menuClassName="min-w-[24rem] rounded-xs border border-orange-200/80 bg-white p-2 shadow-[0_18px_40px_rgba(84,57,26,0.12)]"
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
          {hasUnread ? (
            <span className="absolute -top-1 -right-1 flex min-w-[1.1rem] items-center justify-center rounded-full border border-white bg-orange-500 px-1 text-[9px] leading-4 text-white shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </div>
        {compact ? null : (
          <>
            <div className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate font-medium text-sm text-taupe-900 tracking-tight">
                Change radar
              </span>
              <span className="truncate text-[11px] text-taupe-500 uppercase tracking-[0.18em]">
                {hasUnread
                  ? `${unreadCount} unread bursts`
                  : "Listening quietly"}
              </span>
            </div>
            <CaretDownGlyph className="ml-auto size-4 shrink-0 text-taupe-400" />
          </>
        )}
      </div>
    </MarbleContextPopover>
  );
}
