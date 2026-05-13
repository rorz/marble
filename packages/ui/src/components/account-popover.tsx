"use client";

import type { ReactNode } from "react";
import { cx } from "../utils/cx";
import {
  MarbleContextPopover,
  type MarbleContextPopoverSection,
} from "./context-popover";

type MarbleAccountMarkProps = {
  avatarUrl?: string;
  className?: string;
  displayName?: string;
};

export const MarbleAccountMark = ({
  avatarUrl,
  className,
  displayName,
}: MarbleAccountMarkProps) => {
  if (avatarUrl) {
    return (
      <span
        className={cx(
          "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-taupe-200 bg-white inset-shadow-2xs inset-shadow-white/70",
          className,
        )}
      >
        {/* biome-ignore lint/performance/noImgElement: avatar URL comes from arbitrary identity providers; Next/Image domain config is not warranted here. */}
        <img
          alt={displayName ?? "Account avatar"}
          className="size-full object-cover"
          src={avatarUrl}
        />
      </span>
    );
  }

  const initials = initialsFromDisplayName(displayName ?? "");

  return (
    <span
      aria-hidden={initials === "?" ? "true" : undefined}
      className={cx(
        "relative flex size-8 shrink-0 select-none items-center justify-center rounded-xs border border-taupe-200 bg-taupe-100 font-medium text-taupe-700 text-xs uppercase tracking-wider inset-shadow-2xs inset-shadow-white/70",
        className,
      )}
    >
      {initials}
    </span>
  );
};

type MarbleAccountPopoverProps = {
  align?: "end" | "start";
  ariaLabel?: string;
  avatarUrl?: string;
  className?: string;
  compact?: boolean;
  description?: string;
  disabled?: boolean;
  displayName?: string;
  mark?: ReactNode;
  menuClassName?: string;
  name: string;
  sections: MarbleContextPopoverSection[];
  triggerClassName?: string;
};

const CaretDownGlyph = ({ className }: { className?: string }) => {
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
};

export const MarbleAccountPopover = ({
  align = "start",
  ariaLabel = "Open account menu",
  avatarUrl,
  className,
  compact = false,
  description,
  disabled = false,
  displayName,
  mark,
  menuClassName,
  name,
  sections,
  triggerClassName,
}: MarbleAccountPopoverProps) => {
  const resolvedDisplayName = displayName ?? name;
  const triggerMark = mark ?? (
    <MarbleAccountMark
      avatarUrl={avatarUrl}
      displayName={resolvedDisplayName}
    />
  );
  const headerMark = mark ?? (
    <MarbleAccountMark
      avatarUrl={avatarUrl}
      className="size-9"
      displayName={resolvedDisplayName}
    />
  );

  return (
    <MarbleContextPopover
      align={align}
      ariaLabel={ariaLabel}
      className={className}
      disabled={disabled}
      header={
        <div className="flex items-center gap-3 rounded-xs border border-taupe-200 bg-white px-2 py-2">
          <div className="shrink-0">{headerMark}</div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold text-sm text-taupe-950">
              {name}
            </span>
            {description ? (
              <span className="truncate text-taupe-600 text-xs">
                {description}
              </span>
            ) : null}
          </div>
        </div>
      }
      menuClassName={cx(
        "min-w-[19rem] rounded-xs border border-taupe-200 bg-white p-2 shadow-[0_18px_40px_rgba(84,57,26,0.12)]",
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
        {triggerMark}
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
};

const initialsFromDisplayName = (displayName: string): string => {
  const trimmed = displayName.trim();

  if (trimmed.length === 0) {
    return "?";
  }

  const parts = trimmed.split(/\s+/).filter((part) => part.length > 0);
  const firstPart = parts.at(0);
  const lastPart = parts.at(-1);

  if (!firstPart || !lastPart) {
    return "?";
  }

  if (parts.length === 1) {
    return firstPart.slice(0, 2);
  }

  return `${firstPart.charAt(0)}${lastPart.charAt(0)}`;
};
