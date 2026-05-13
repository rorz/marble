import { cx, MarbleLink, useMarbleRouter } from "@marble/ui";
import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";

import type { ReactNode } from "react";

import { getChangeTargetProps } from "../change-spotlight";

export const SidebarNavRow = ({
  active = false,
  expandable = false,
  expanded = false,
  href,
  icon,
  iconOnly,
  label,
  onSelect,
  onToggle,
  previewTone = null,
  targetKey,
  title,
}: {
  active?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  href: string;
  icon: ReactNode;
  iconOnly: boolean;
  label: string;
  onSelect?: () => void;
  onToggle?: () => void;
  previewTone?: "ancestor" | "direct" | null;
  targetKey?: string;
  title?: string;
}) => {
  const router = useMarbleRouter();
  const showDisclosure = expandable && !iconOnly;
  const showIconSlot = Boolean(icon);

  return (
    <div
      className={cx(
        "group flex min-w-0 items-center rounded-md text-taupe-700 transition-colors",
        active
          ? "bg-taupe-300/80 text-taupe-900"
          : previewTone === "direct"
            ? "bg-white text-taupe-900 inset-ring-1 inset-ring-orange-500/40"
            : previewTone === "ancestor"
              ? "bg-orange-50/80 text-taupe-900"
              : "hover:bg-taupe-200/80 hover:text-taupe-900",
        iconOnly ? "w-auto justify-center" : "w-full pr-1",
      )}
      {...(targetKey ? getChangeTargetProps(targetKey) : {})}
    >
      <MarbleLink
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex min-w-0 flex-1 items-center",
          iconOnly ? "justify-center p-2" : "gap-1.5 px-2 py-0.5 h-7",
        )}
        href={href}
        onClick={(event) => {
          if (onSelect) {
            event.preventDefault();
            onSelect();
            return;
          }

          if (expandable && !expanded) {
            onToggle?.();
          }
        }}
        title={title}
      >
        {showIconSlot ? (
          <div className="flex size-5 shrink-0 items-center justify-center">
            {icon}
          </div>
        ) : null}
        {iconOnly ? null : (
          <span className="truncate font-medium text-sm tracking-tight">
            {label}
          </span>
        )}
      </MarbleLink>

      {showDisclosure ? (
        <button
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-sm text-current opacity-60 transition-opacity hover:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            const nextExpanded = !expanded;

            onToggle?.();

            if (!active && nextExpanded) {
              router.push(href);
            }
          }}
          type="button"
        >
          {expanded ? (
            <CaretDownIcon
              size={12}
              weight="bold"
            />
          ) : (
            <CaretRightIcon
              size={12}
              weight="bold"
            />
          )}
        </button>
      ) : null}
    </div>
  );
};
