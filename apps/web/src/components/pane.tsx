import { cx, MarbleButton, type MarbleButtonProps } from "@marble/ui";
import type { FunctionComponent, ReactNode } from "react";

type PaneProps = {
  title: string;
  children: ReactNode;
  actions?: (MarbleButtonProps & {
    id: string;
  })[];
};

export const Pane: FunctionComponent<PaneProps> = ({
  title,
  children,
  actions,
}) => {
  return (
    <div className="size-full flex flex-col items-start w-full">
      <div className="flex justify-between items-center gap-1 w-full border-b border-taupe-200 px-4 py-2">
        <h1 className="font-medium text-base text-neutral-800">{title}</h1>
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
