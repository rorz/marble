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
};

export const Pane: FunctionComponent<PaneProps> = ({
  crumbs,
  children,
  actions,
  title,
  width = "Full",
}) => {
  return (
    <div className="size-full flex flex-col items-start w-full overflow-y-scroll">
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
      <div className="p-4 size-full flex justify-center">
        <div
          className={cx(
            "h-full flex flex-col w-full",
            width === "Narrow" && "max-w-2xl",
            crumbs === undefined && width === "Narrow" && "pt-12",
          )}
        >
          {title && <h2 className="text-2xl mb-4">{title}</h2>}
          {children}
        </div>
      </div>
    </div>
  );
};
