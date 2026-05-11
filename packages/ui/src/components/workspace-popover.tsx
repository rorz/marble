"use client";

import type { ReactNode } from "react";
import { cx } from "../utils/cx";
import {
  MarbleContextPopover,
  type MarbleContextPopoverSection,
} from "./context-popover";

export type MarbleWorkspaceMarkProps = {
  className?: string;
};

export function MarbleWorkspaceMark({ className }: MarbleWorkspaceMarkProps) {
  return (
    <div
      className={cx(
        "relative flex size-8 shrink-0 items-center justify-center rounded-xs border border-orange-200/80 bg-white shadow-marble-highlight-strong",
        className,
      )}
    >
      <div className="size-4 rounded-full border border-taupe-500 bg-taupe-100" />
      <div className="absolute top-1.5 right-1.5 size-2 rounded-full border border-white bg-orange-400" />
    </div>
  );
}

type MarbleWorkspacePopoverProps = {
  align?: "end" | "start";
  ariaLabel?: string;
  className?: string;
  compact?: boolean;
  description?: string;
  disabled?: boolean;
  mark?: ReactNode;
  menuClassName?: string;
  name: string;
  sections: MarbleContextPopoverSection[];
  status?: ReactNode;
  triggerClassName?: string;
};

function DefaultStatusIndicator() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-orange-200/80 bg-orange-50">
      <span className="size-2 rounded-full bg-orange-500" />
    </span>
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

export function MarbleWorkspacePopover({
  align = "start",
  ariaLabel = "Open workspace menu",
  className,
  compact = false,
  description,
  disabled = false,
  mark,
  menuClassName,
  name,
  sections,
  status,
  triggerClassName,
}: MarbleWorkspacePopoverProps) {
  const resolvedMark = mark ?? <MarbleWorkspaceMark />;
  const resolvedStatus =
    status === undefined ? <DefaultStatusIndicator /> : status;

  return (
    <MarbleContextPopover
      align={align}
      ariaLabel={ariaLabel}
      className={className}
      disabled={disabled}
      header={
        <div className="flex items-center gap-3 rounded-xs border border-orange-200/70 bg-orange-50/50 px-2 py-2">
          <div className="shrink-0">
            {mark ?? <MarbleWorkspaceMark className="size-9" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold text-sm text-taupe-950">
              {name}
            </span>
            {description ? (
              <span className="text-xs text-taupe-600">{description}</span>
            ) : null}
          </div>
          {resolvedStatus}
        </div>
      }
      menuClassName={cx(
        "min-w-[19rem] rounded-xs border border-orange-200/80 bg-white p-2 shadow-[0_18px_40px_rgba(84,57,26,0.12)]",
        menuClassName,
      )}
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
          compact ? "justify-center" : "gap-2",
        )}
      >
        {resolvedMark}
        {compact ? null : (
          <>
            <span className="truncate font-medium text-sm text-taupe-900 tracking-tight">
              {name}
            </span>
            <CaretDownGlyph className="ml-auto size-4 shrink-0 text-taupe-400" />
          </>
        )}
      </div>
    </MarbleContextPopover>
  );
}

export type { MarbleWorkspacePopoverProps };
