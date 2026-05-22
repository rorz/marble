import {
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
} from "@marble/ui";
import type { ReactNode } from "react";

export const Showcase = ({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) => {
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
        <MarbleCardContent className="space-y-6 pt-5">
          {children}
        </MarbleCardContent>
      </MarbleCard>
    </section>
  );
};

export const Demo = ({
  label,
  description,
  contained = true,
  children,
}: {
  label: string;
  description?: string;
  contained?: boolean;
  children: ReactNode;
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-eyebrow text-taupe-700">{label}</span>
        {description ? (
          <span className="text-sm text-taupe-600">{description}</span>
        ) : null}
      </div>
      {contained ? (
        <div className="rounded-xs border-2 border-dashed border-taupe-300 bg-taupe-50 p-6">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export const AnimationSwatch = ({
  cls,
  label,
  swatch,
  text,
}: {
  cls: string;
  label: string;
  swatch?: boolean;
  text?: boolean;
}) => {
  return (
    <div className="flex flex-col gap-2 rounded-xs border-2 border-taupe-300 bg-taupe-50 p-4">
      <span className="font-mono text-eyebrow-xs text-taupe-700">{label}</span>
      <div className="flex h-12 items-center justify-center rounded-xs border border-taupe-200 bg-taupe-100">
        {swatch ? (
          <span className={`block size-4 rounded-full bg-orange-500 ${cls}`} />
        ) : null}
        {text ? (
          <span className={`font-mono text-base text-orange-500 ${cls}`}>
            0420
          </span>
        ) : null}
      </div>
      <code className="break-all font-mono text-[10px] text-taupe-500">
        {cls}
      </code>
    </div>
  );
};
