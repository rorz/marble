"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

const MARBLE_REVIEW_NAVIGATOR_MARKER_LIMIT = 8;

function getVisibleMarkerIndexes(activeIndex: number, totalCount: number) {
  if (totalCount <= MARBLE_REVIEW_NAVIGATOR_MARKER_LIMIT) {
    return Array.from({
      length: totalCount,
    }).map((_, index) => index);
  }

  const halfWindow = Math.floor(MARBLE_REVIEW_NAVIGATOR_MARKER_LIMIT / 2);
  const startIndex = Math.max(
    0,
    Math.min(
      activeIndex - halfWindow,
      totalCount - MARBLE_REVIEW_NAVIGATOR_MARKER_LIMIT,
    ),
  );

  return Array.from({
    length: MARBLE_REVIEW_NAVIGATOR_MARKER_LIMIT,
  }).map((_, offset) => startIndex + offset);
}

function ChevronLeftGlyph() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 14 14"
      width="14"
    >
      <path
        d="M8.75 2.75 4.5 7l4.25 4.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ChevronRightGlyph() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 14 14"
      width="14"
    >
      <path
        d="M5.25 2.75 9.5 7l-4.25 4.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 14 14"
      width="14"
    >
      <path
        d="m4 4 6 6M10 4 4 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ReviewNavigatorButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "flex h-7 w-7 items-center justify-center rounded-[6px] border border-taupe-200/90 bg-taupe-50 text-taupe-600 transition-colors hover:border-orange-200 hover:bg-white hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export type MarbleReviewNavigatorDiff = {
  count: number;
  targetKeys?: string[];
  tone: "create" | "delete" | "update";
};

export type MarbleReviewNavigatorDetailItem = {
  diffs?: MarbleReviewNavigatorDiff[];
  label: string;
  targetKeys?: string[];
};

function formatDiffLabel(diff: MarbleReviewNavigatorDiff) {
  if (diff.tone === "create") {
    return `+${diff.count}`;
  }

  if (diff.tone === "delete") {
    return `-${diff.count}`;
  }

  return `~${diff.count}`;
}

function ReviewNavigatorPreviewButton({
  children,
  className,
  onPreviewTargetsEnd,
  onPreviewTargetsStart,
  targetKeys,
}: {
  children: ReactNode;
  className?: string;
  onPreviewTargetsEnd?: () => void;
  onPreviewTargetsStart?: (targetKeys: string[]) => void;
  targetKeys?: string[];
}) {
  if (!targetKeys || targetKeys.length === 0) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button
      className={cx(
        "rounded-[5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300",
        className,
      )}
      onBlur={onPreviewTargetsEnd}
      onFocus={() => onPreviewTargetsStart?.(targetKeys)}
      onPointerEnter={() => onPreviewTargetsStart?.(targetKeys)}
      type="button"
    >
      {children}
    </button>
  );
}

function ReviewDiffChip({
  diff,
  fallbackTargetKeys,
  onPreviewTargetsEnd,
  onPreviewTargetsStart,
}: {
  diff: MarbleReviewNavigatorDiff;
  fallbackTargetKeys?: string[];
  onPreviewTargetsEnd?: () => void;
  onPreviewTargetsStart?: (targetKeys: string[]) => void;
}) {
  const targetKeys = diff.targetKeys ?? fallbackTargetKeys;

  return (
    <ReviewNavigatorPreviewButton
      className="-mx-0.5 inline-flex"
      onPreviewTargetsEnd={onPreviewTargetsEnd}
      onPreviewTargetsStart={onPreviewTargetsStart}
      targetKeys={targetKeys}
    >
      <span
        className={cx(
          "inline-flex items-center rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] leading-none transition-colors",
          diff.tone === "create"
            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : diff.tone === "delete"
              ? "bg-red-50 text-red-700 hover:bg-red-100"
              : "bg-amber-50 text-amber-700 hover:bg-amber-100",
        )}
      >
        {formatDiffLabel(diff)}
      </span>
    </ReviewNavigatorPreviewButton>
  );
}

export type MarbleReviewNavigatorProps = HTMLAttributes<HTMLDivElement> & {
  currentIndex: number;
  detail?: string;
  detailItems?: MarbleReviewNavigatorDetailItem[];
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onPreviewTargetsEnd?: () => void;
  onPreviewTargetsStart?: (targetKeys: string[]) => void;
  onSelectIndex?: (index: number) => void;
  summary: string;
  totalCount: number;
};

export function MarbleReviewNavigator({
  className,
  currentIndex,
  detail,
  detailItems,
  onClose,
  onNext,
  onPrevious,
  onPreviewTargetsEnd,
  onPreviewTargetsStart,
  onSelectIndex,
  summary,
  totalCount,
  ...props
}: MarbleReviewNavigatorProps) {
  const markerIndexes = getVisibleMarkerIndexes(currentIndex, totalCount);

  return (
    <div
      className={cx(
        "flex max-w-[42rem] items-center gap-3 rounded-[10px] border border-taupe-200/90 bg-white/96 px-3 py-2 shadow-[0_18px_40px_rgba(84,57,26,0.12)] backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-sm text-taupe-950">
          {summary}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-taupe-500">
          {detailItems && detailItems.length > 0 ? (
            detailItems.map((item) => (
              <span
                className="inline-flex items-center gap-1.5"
                key={`${item.label}:${item.diffs?.length ?? 0}`}
                onPointerLeave={
                  item.targetKeys || item.diffs?.some((diff) => diff.targetKeys)
                    ? onPreviewTargetsEnd
                    : undefined
                }
              >
                <ReviewNavigatorPreviewButton
                  className="inline-flex items-center rounded-[5px] px-1 py-0.5 font-medium text-taupe-600 hover:bg-taupe-100 hover:text-taupe-900"
                  onPreviewTargetsEnd={onPreviewTargetsEnd}
                  onPreviewTargetsStart={onPreviewTargetsStart}
                  targetKeys={item.targetKeys}
                >
                  {item.label}
                </ReviewNavigatorPreviewButton>
                {item.diffs?.map((diff) => (
                  <ReviewDiffChip
                    diff={diff}
                    fallbackTargetKeys={item.targetKeys}
                    key={`${item.label}:${diff.tone}`}
                    onPreviewTargetsEnd={onPreviewTargetsEnd}
                    onPreviewTargetsStart={onPreviewTargetsStart}
                  />
                ))}
              </span>
            ))
          ) : detail ? (
            <span className="truncate font-mono">{detail}</span>
          ) : null}
          <span className="font-mono text-taupe-400">
            {currentIndex + 1} of {totalCount}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {markerIndexes.map((index) => (
          <button
            aria-label={`Jump to change ${index + 1}`}
            className={cx(
              "h-1.5 rounded-[4px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300",
              index === currentIndex
                ? "w-6 bg-orange-500"
                : "w-3 bg-taupe-200 hover:bg-taupe-300",
            )}
            key={index}
            onClick={() => onSelectIndex?.(index)}
            type="button"
          />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ReviewNavigatorButton
          aria-label="Previous change"
          onClick={onPrevious}
        >
          <ChevronLeftGlyph />
        </ReviewNavigatorButton>
        <ReviewNavigatorButton
          aria-label="Next change"
          onClick={onNext}
        >
          <ChevronRightGlyph />
        </ReviewNavigatorButton>
        <ReviewNavigatorButton
          aria-label="Close review"
          onClick={onClose}
        >
          <CloseGlyph />
        </ReviewNavigatorButton>
      </div>
    </div>
  );
}
