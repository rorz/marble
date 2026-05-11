import type { ReactNode } from "react";
import { cx } from "../utils/cx";
import { MarbleButton, type MarbleButtonProps } from "./button";
import {
  MarbleContextPopover,
  type MarbleContextPopoverItem,
} from "./context-popover";

export type MarblePaneCrumb = {
  href?: string;
  id: string;
  label: ReactNode;
  onClick?: () => void;
};

export type MarblePaneProps = {
  actions?: (MarbleButtonProps & {
    id: string;
  })[];
  children: ReactNode;
  crumbs?: MarblePaneCrumb[];
  description?: string;
  disclosureActions?: MarbleContextPopoverItem[];
  disclosureAriaLabel?: string;
  frame?: "normal" | "none";
  title?: string;
  width?: "Full" | "Narrow";
  className?: string;
};

export const marblePaneCrumbClassName =
  "rounded-sm px-1.5 py-1 font-medium text-sm text-taupe-800 transition-colors";
export const marblePaneInteractiveCrumbClassName = cx(
  marblePaneCrumbClassName,
  "hover:bg-taupe-100",
);

export function MarblePane({
  actions,
  children,
  className,
  crumbs,
  description,
  disclosureActions,
  disclosureAriaLabel = "Open pane actions",
  frame = "normal",
  title,
  width = "Full",
}: MarblePaneProps) {
  const isFramed = frame === "normal";

  return (
    <div className="flex size-full min-h-0 w-full flex-col">
      {crumbs ? (
        <div className="flex w-full items-center justify-between gap-1 border-b border-taupe-200 px-4 py-2">
          <div className="flex min-w-0 items-center gap-1">
            {crumbs.flatMap((crumb, index) => [
              typeof crumb.label === "string" ? (
                crumb.href ? (
                  <a
                    className={marblePaneInteractiveCrumbClassName}
                    href={crumb.href}
                    key={crumb.id}
                  >
                    {crumb.label}
                  </a>
                ) : crumb.onClick ? (
                  <button
                    className={marblePaneInteractiveCrumbClassName}
                    key={crumb.id}
                    onClick={crumb.onClick}
                    type="button"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span
                    className={marblePaneCrumbClassName}
                    key={crumb.id}
                  >
                    {crumb.label}
                  </span>
                )
              ) : (
                <div key={crumb.id}>{crumb.label}</div>
              ),
              index < crumbs.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="text-taupe-300"
                  key={`${crumb.id}-separator`}
                >
                  &gt;
                </span>
              ) : null,
            ])}
          </div>

          {actions?.length || disclosureActions?.length ? (
            <div className="flex shrink-0 items-center gap-2">
              {actions?.map((action) => (
                <MarbleButton
                  key={action.id}
                  {...action}
                  size="sm"
                />
              ))}
              {disclosureActions?.length ? (
                <MarbleContextPopover
                  ariaLabel={disclosureAriaLabel}
                  items={disclosureActions}
                  triggerClassName="text-zinc-300 hover:bg-transparent hover:text-zinc-500"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cx(
          "flex min-h-0 w-full flex-1 justify-center overflow-y-scroll",
          isFramed ? "px-4" : "px-0",
        )}
      >
        <div
          className={cx(
            "flex h-full min-h-0 w-full flex-col",
            width === "Narrow" ? "max-w-2xl" : "",
            isFramed
              ? crumbs === undefined
                ? width === "Narrow"
                  ? "pt-16"
                  : "pt-12"
                : width === "Narrow"
                  ? "pt-10"
                  : "pt-4"
              : "pt-0",
            className,
          )}
        >
          {title || description ? (
            <div className="mb-6 flex w-full flex-none flex-col gap-2">
              {title ? <h2 className="text-2xl">{title}</h2> : null}
              {description ? (
                <span className="text-sm text-taupe-600">{description}</span>
              ) : null}
            </div>
          ) : null}

          <div
            className={cx(
              "flex min-h-0 flex-1 flex-col",
              isFramed ? "pb-4" : "pb-0",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
