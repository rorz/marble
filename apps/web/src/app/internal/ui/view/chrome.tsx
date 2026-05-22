import {
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
} from "@marble/ui";
import type { ReactNode } from "react";

export const Section = ({
  children,
  description,
  id,
  title,
}: Readonly<{
  children: ReactNode;
  description: string;
  id: string;
  title: string;
}>) => {
  return (
    <section
      className="scroll-mt-6"
      id={id}
    >
      <MarbleCard>
        <MarbleCardHeader className="gap-1 pb-4">
          <MarbleCardTitle className="text-lg text-taupe-950">
            {title}
          </MarbleCardTitle>
          <MarbleCardDescription className="max-w-3xl text-taupe-600">
            {description}
          </MarbleCardDescription>
        </MarbleCardHeader>
        <MarbleCardContent className="space-y-4 pt-5">
          {children}
        </MarbleCardContent>
      </MarbleCard>
    </section>
  );
};

export const DemoPanel = ({
  children,
  className,
  contentClassName,
  description,
  title,
  tone = "default",
}: Readonly<{
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: string;
  title: string;
  tone?: "default" | "orange" | "subtle";
}>) => {
  return (
    <MarbleCard
      className={className}
      tone={tone}
    >
      <MarbleCardHeader className="gap-1 pb-4">
        <MarbleCardTitle>{title}</MarbleCardTitle>
        {description ? (
          <MarbleCardDescription>{description}</MarbleCardDescription>
        ) : null}
      </MarbleCardHeader>
      <MarbleCardContent className={contentClassName}>
        {children}
      </MarbleCardContent>
    </MarbleCard>
  );
};
