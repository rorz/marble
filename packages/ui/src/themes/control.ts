import { cx } from "../internal/cx";

export const marbleControlSizeClassNames = {
  md: "px-3 py-1.5 text-sm",
  sm: "px-2.5 py-1.5 text-sm",
  xs: "px-2 py-1 text-xs",
} as const;

export type MarbleControlSize = keyof typeof marbleControlSizeClassNames;

const marbleControlBaseClassName =
  "w-full rounded-md border-x border-t border-b-2 border-neutral-200 border-b-neutral-300 bg-white text-neutral-900 shadow-sm transition-colors placeholder-neutral-400 focus:border-b-orange-400 focus:outline-none";

export function getMarbleInputClassName({
  className,
  size = "md",
}: {
  className?: string;
  size?: MarbleControlSize;
}) {
  return cx(
    marbleControlBaseClassName,
    marbleControlSizeClassNames[size],
    className,
  );
}

export function getMarbleSelectClassName({
  className,
  size = "md",
}: {
  className?: string;
  size?: MarbleControlSize;
}) {
  return cx(
    marbleControlBaseClassName,
    marbleControlSizeClassNames[size],
    "appearance-none cursor-pointer pr-8",
    className,
  );
}

export function getMarbleTextareaClassName({
  className,
  monospace = false,
  size = "md",
}: {
  className?: string;
  monospace?: boolean;
  size?: MarbleControlSize;
}) {
  return cx(
    marbleControlBaseClassName,
    marbleControlSizeClassNames[size],
    "resize-y",
    monospace && "font-mono",
    className,
  );
}
