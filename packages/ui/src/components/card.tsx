import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleCardVariants = cva("overflow-hidden rounded-xs border", {
  defaultVariants: {
    tone: "default",
  },
  variants: {
    tone: {
      default: "border-taupe-200 bg-white text-taupe-900 rounded-xs",
      orange:
        "border-orange-200 bg-linear-to-br from-orange-50 via-white to-white text-zinc-950",
      subtle: "border-zinc-200 bg-zinc-50 text-zinc-950",
    },
  },
});

const marbleCardHeaderVariants = cva("flex flex-col gap-1.5 p-5");
const marbleCardContentVariants = cva("px-5 pb-5");
const marbleCardFooterVariants = cva("flex items-center gap-3 px-5 pb-5 pt-2");
const marbleCardTitleVariants = cva("font-semibold text-sm text-zinc-900");
const marbleCardDescriptionVariants = cva("text-sm text-zinc-600");

export type MarbleCardProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof marbleCardVariants>;

export function MarbleCard({
  children,
  className,
  tone,
  ...props
}: MarbleCardProps) {
  return (
    <div
      className={cx(
        marbleCardVariants({
          tone,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type MarbleCardHeaderProps = HTMLAttributes<HTMLDivElement>;

export function MarbleCardHeader({
  children,
  className,
  ...props
}: MarbleCardHeaderProps) {
  return (
    <div
      className={cx(marbleCardHeaderVariants(), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type MarbleCardContentProps = HTMLAttributes<HTMLDivElement>;

export function MarbleCardContent({
  children,
  className,
  ...props
}: MarbleCardContentProps) {
  return (
    <div
      className={cx(marbleCardContentVariants(), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type MarbleCardFooterProps = HTMLAttributes<HTMLDivElement>;

export function MarbleCardFooter({
  children,
  className,
  ...props
}: MarbleCardFooterProps) {
  return (
    <div
      className={cx(marbleCardFooterVariants(), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type MarbleCardTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function MarbleCardTitle({
  children,
  className,
  ...props
}: MarbleCardTitleProps) {
  return (
    <h2
      className={cx(marbleCardTitleVariants(), className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export type MarbleCardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function MarbleCardDescription({
  children,
  className,
  ...props
}: MarbleCardDescriptionProps) {
  return (
    <p
      className={cx(marbleCardDescriptionVariants(), className)}
      {...props}
    >
      {children}
    </p>
  );
}
