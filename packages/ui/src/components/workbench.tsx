"use client";

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react";
import { cx } from "../utils/cx";

function WorkbenchChevronIcon({
  collapsed,
}: Readonly<{
  collapsed: boolean;
}>) {
  return (
    <svg
      aria-hidden="true"
      className={cx(
        "size-3 shrink-0 text-taupe-500 transition-transform",
        collapsed ? "-rotate-90" : "rotate-0",
      )}
      fill="none"
      viewBox="0 0 12 12"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function WorkbenchCloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      viewBox="0 0 12 12"
    >
      <path
        d="M3 3L9 9M9 3L3 9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

export type MarbleWorkbenchSectionProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  badge?: ReactNode;
  bodyClassName?: string;
  bodyStyle?: CSSProperties;
  collapsed?: boolean;
  collapsible?: boolean;
  description?: ReactNode;
  headerClassName?: string;
  icon?: ReactNode;
  onToggleCollapsed?: () => void;
  title: ReactNode;
};

export function MarbleWorkbenchSection({
  actions,
  badge,
  bodyClassName,
  bodyStyle,
  children,
  className,
  collapsed = false,
  collapsible = false,
  description,
  headerClassName,
  icon,
  onToggleCollapsed,
  title,
  ...props
}: MarbleWorkbenchSectionProps) {
  const canToggle = collapsible && Boolean(onToggleCollapsed);
  const hasDescription = description !== undefined && description !== null;
  const titleBlock = (
    <>
      {collapsible ? <WorkbenchChevronIcon collapsed={collapsed} /> : null}
      {icon ? (
        <span
          className={cx(
            "flex size-4 shrink-0 items-center justify-center text-taupe-500",
            hasDescription ? "mt-0.5" : "",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-eyebrow-xs text-taupe-700">
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-4 text-taupe-500">
            {description}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <section
      className={cx(
        "flex min-h-0 flex-col overflow-hidden rounded-sm border border-taupe-400/80 bg-white/70 text-taupe-900 shadow-[0_12px_22px_rgba(84,57,26,0.08)]",
        className,
      )}
      {...props}
    >
      <div
        className={cx(
          "flex justify-between gap-2 border-b border-taupe-400/80 bg-linear-to-r from-taupe-100/95 to-white/65 px-2.5 py-2",
          hasDescription ? "items-start" : "items-center",
          headerClassName,
        )}
      >
        {canToggle ? (
          <button
            className={cx(
              "flex min-w-0 flex-1 gap-2 text-left transition-colors hover:text-taupe-950",
              hasDescription ? "items-start" : "items-center",
            )}
            onClick={onToggleCollapsed}
            type="button"
          >
            {titleBlock}
          </button>
        ) : (
          <div
            className={cx(
              "flex min-w-0 flex-1 gap-2",
              hasDescription ? "items-start" : "items-center",
            )}
          >
            {titleBlock}
          </div>
        )}

        {badge || actions ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {badge}
            {actions}
          </div>
        ) : null}
      </div>

      {collapsed ? null : (
        <div
          className={cx("min-h-0 overflow-hidden bg-white/92", bodyClassName)}
          style={bodyStyle}
        >
          {children}
        </div>
      )}
    </section>
  );
}

export type MarbleWorkbenchResizeHandleProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  active?: boolean;
  orientation?: "horizontal" | "vertical";
};

export function MarbleWorkbenchResizeHandle({
  active = false,
  className,
  orientation = "horizontal",
  type = "button",
  ...props
}: MarbleWorkbenchResizeHandleProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <button
      className={cx(
        "group/workbench-handle relative z-10 shrink-0 overflow-visible touch-none bg-transparent focus-visible:outline-none",
        isHorizontal
          ? "-my-px h-px w-full cursor-row-resize"
          : "-mx-px h-full w-px cursor-col-resize",
        className,
      )}
      type={type}
      {...props}
    >
      <span
        className={cx(
          "absolute block",
          isHorizontal
            ? "inset-x-0 -top-2 h-[17px]"
            : "-left-2 inset-y-0 w-[17px]",
        )}
      />
      <span
        className={cx(
          "pointer-events-none absolute block transition-colors",
          isHorizontal ? "inset-x-0 top-0 h-px" : "left-0 inset-y-0 w-px",
          active
            ? "bg-orange-500/80"
            : "group-hover/workbench-handle:bg-taupe-400",
        )}
      />
    </button>
  );
}

export type MarbleWorkbenchTabsProps = HTMLAttributes<HTMLDivElement>;

export function MarbleWorkbenchTabs({
  children,
  className,
  ...props
}: MarbleWorkbenchTabsProps) {
  return (
    <div
      className={cx(
        "flex min-w-0 items-stretch overflow-x-auto border-b border-taupe-300 bg-linear-to-b from-taupe-200/90 to-taupe-100/95",
        className,
      )}
      role="tablist"
      {...props}
    >
      {children}
    </div>
  );
}

export type MarbleWorkbenchTabProps = HTMLAttributes<HTMLDivElement> & {
  active?: boolean;
  dirty?: boolean;
  icon?: ReactNode;
  label: string;
  onClose?: () => void;
  onSelect?: () => void;
};

export function MarbleWorkbenchTab({
  active = false,
  className,
  dirty = false,
  icon,
  label,
  onClose,
  onSelect,
  ...props
}: MarbleWorkbenchTabProps) {
  return (
    <div
      className={cx(
        "group flex h-9 shrink-0 items-center border-r border-taupe-300 text-[12px] transition-colors",
        active
          ? "bg-white text-taupe-950 shadow-marble-stripe-top"
          : "bg-transparent text-taupe-600 hover:bg-white/70 hover:text-taupe-950",
        className,
      )}
      {...props}
    >
      <button
        aria-label={`Open ${label}`}
        aria-selected={active}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-0 text-left"
        onClick={onSelect}
        role="tab"
        title={label}
        type="button"
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="max-w-48 truncate">{label}</span>
      </button>

      {dirty ? <span className="size-1.5 rounded-full bg-orange-500" /> : null}

      {onClose ? (
        <button
          aria-label={`Close ${label}`}
          className="mr-1 flex size-6 items-center justify-center rounded-sm text-taupe-500 transition-colors hover:bg-black/5 hover:text-taupe-950"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          type="button"
        >
          <WorkbenchCloseIcon />
        </button>
      ) : null}
    </div>
  );
}
