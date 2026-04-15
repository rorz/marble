import { cx, MarbleButton, type MarbleButtonProps } from "@marble/ui";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import type { FunctionComponent, ReactNode } from "react";

type Crumb = {
  label: string;
};

type PaneProps = {
  crumbs?: Crumb[];
  children: ReactNode;
  actions?: (MarbleButtonProps & {
    id: string;
  })[];
  width?: "Full" | "Narrow";
  title?: string;
  description?: string;
};

export const Pane: FunctionComponent<PaneProps> = ({
  crumbs,
  children,
  actions,
  title,
  description,
  width = "Full",
}) => {
  return (
    <div className="size-full flex flex-col items-start w-full ">
      {crumbs && (
        <div className="flex justify-between items-center gap-1 w-full border-b border-taupe-200 px-4 py-2">
          <div className="flex gap-1 items-center">
            {crumbs.flatMap((crumb, idx) => [
              <span
                className="font-medium text-base text-neutral-800 hover:bg-taupe-100 transition-colors cursor-pointer px-1.5 py-1 rounded-sm"
                key={crumb.label}
              >
                {crumb.label}
              </span>,
              idx < crumbs.length - 1 ? (
                <span
                  className="text-taupe-300"
                  key={`slash_key_for--${crumb.label}`}
                >
                  <CaretRightIcon />
                </span>
              ) : (
                []
              ),
            ])}
          </div>
          {actions?.map((action) => (
            <MarbleButton
              key={action.id}
              {...action}
              size="sm"
            />
          ))}
        </div>
      )}
      {/* 
        NOTE:   The awkward-looking padding values are due to overflow-y-scroll
                not allowing top-level i.e. p-4 padding to apply to scroll views
      */}
      <div className="px-4 size-full flex justify-center overflow-y-scroll">
        <div
          className={cx(
            "h-full flex flex-col w-full",
            width === "Narrow" && "max-w-2xl",
            crumbs === undefined && width === "Narrow" ? "pt-12" : "pt-4",
          )}
        >
          {(title || description) && (
            <div className="flex w-full flex-col gap-2 mb-6">
              {title && <h2 className="text-2xl">{title}</h2>}
              {description && (
                <span className="text-sm text-taupe-600 ">{description}</span>
              )}
            </div>
          )}
          <div className="pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
};
