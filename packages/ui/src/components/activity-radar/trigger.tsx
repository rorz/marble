"use client";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import { getRadarSummary } from ".";
import {
  ActivityGlyph,
  ActivityUnreadBadge,
  CaretDownGlyph,
  type MarbleActivityRadarBatch,
} from "./glyph";

export type MarbleActivityRadarTriggerProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  batches: MarbleActivityRadarBatch[];
  compact?: boolean;
  slim?: boolean;
  unreadCount?: number;
};

export const MarbleActivityRadarTrigger = ({
  batches,
  className,
  compact = false,
  slim = false,
  type = "button",
  unreadCount = 0,
  ...props
}: MarbleActivityRadarTriggerProps) => {
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
};
