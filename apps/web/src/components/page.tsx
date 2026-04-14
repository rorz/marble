import { cx, type MarbleButtonProps } from "@marble/ui";
import type { FunctionComponent, ReactNode } from "react";

type PageProps = {
  title: string;
  subtitle: string;
  showBackButton?: boolean;
  width?: "Wide" | "Standard" | "Narrow";
  children: ReactNode;
  actions?: MarbleButtonProps[];
};

export const Page: FunctionComponent<PageProps> = ({
  title,
  subtitle,
  children,
  width = "Standard",
}) => {
  return (
    <div className="size-full flex items-start justify-center">
      <div
        className={cx(
          "flex flex-col items-start gap-8 w-full",
          width === "Wide"
            ? "max-w-full"
            : width === "Standard"
              ? "max-w-7xl"
              : "max-w-3xl",
        )}
      >
        <div className="flex flex-col items-start gap-1 w-full pt-12">
          <h1 className="font-semibold text-2xl text-neutral-950">{title}</h1>
          <h2 className="font-regular text-base text-neutral-500">
            {subtitle}
          </h2>
        </div>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
};
