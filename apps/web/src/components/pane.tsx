import { MarbleButton, type MarbleButtonProps } from "@marble/ui";
import type { FunctionComponent, ReactNode } from "react";

type Crumb = {
  label: string;
};

type PaneProps = {
  crumbs: Crumb[];
  children: ReactNode;
  actions?: (MarbleButtonProps & {
    id: string;
  })[];
};

export const Pane: FunctionComponent<PaneProps> = ({
  crumbs,
  children,
  actions,
}) => {
  return (
    <div className="size-full flex flex-col items-start w-full">
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
                |
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
      <div className="size-full p-4">{children}</div>
    </div>
  );
};
