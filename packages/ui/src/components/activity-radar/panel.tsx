"use client";
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../utils/cx";
import { MarbleListRow } from "../list-row";
import { getRadarSummary } from ".";
import {
  ActivityBatchDescription,
  ActivityGlyph,
  ActivityMeter,
  ActivityUnreadBadge,
  type MarbleActivityRadarBatch,
} from "./glyph";

export type MarbleActivityRadarPanelProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  batches: MarbleActivityRadarBatch[];
  emptyDescription?: string;
  onMarkAllRead?: () => void;
  unreadCount?: number;
};

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
        "flex min-h-0 flex-col overflow-hidden rounded-sm border border-taupe-300/80 bg-linear-to-b from-taupe-50/95 to-white/95 text-taupe-900 shadow-lg shadow-taupe-900/10",
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
