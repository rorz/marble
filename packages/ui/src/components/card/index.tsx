"use client";

import type { VariantProps } from "class-variance-authority";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../utils/cx";
import { MarbleButton, type MarbleButtonProps } from "../button";
import {
  MarbleContextPopover,
  type MarbleContextPopoverItem,
} from "../context-popover";
import { MarbleLink } from "../link";
import {
  marbleCardContentVariants,
  marbleCardDescriptionVariants,
  marbleCardFooterVariants,
  marbleCardHeaderActionsVariants,
  marbleCardHeaderTextVariants,
  marbleCardHeaderVariants,
  marbleCardInteractiveBaseClassName,
  marbleCardInteractiveHoverByTone,
  marbleCardNoiseStyles,
  marbleCardSectionVariants,
  marbleCardSurfaceStyles,
  marbleCardTitleVariants,
  marbleCardVariants,
} from "./styles";

export type MarbleCardProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof marbleCardVariants> & {
    /**
     * Render the card as a `next/link` `<Link>` and auto-publish to
     * `<MarbleRouteProgress />`. The card receives hover, cursor, and
     * focus-visible affordances by default.
     */
    href?: string;
    /**
     * Force hover/cursor/focus affordances even without an `href` (e.g. for
     * `onClick` cards). Implied when `href` is set.
     */
    interactive?: boolean;
  };

export const MarbleCard = ({
  children,
  className,
  href,
  interactive,
  tone,
  style,
  ...props
}: MarbleCardProps) => {
  const resolvedTone = tone ?? "default";
  const isInteractive = interactive ?? Boolean(href);

  const surfaceClassName = cx(
    marbleCardVariants({
      tone: resolvedTone,
    }),
    isInteractive && marbleCardInteractiveBaseClassName,
    isInteractive && marbleCardInteractiveHoverByTone[resolvedTone],
    className,
  );

  const surfaceStyle: CSSProperties = {
    ...marbleCardSurfaceStyles[resolvedTone],
    ...style,
  };

  const inner = (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={marbleCardNoiseStyles[resolvedTone]}
      />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </>
  );

  if (href) {
    return (
      <MarbleLink
        className={surfaceClassName}
        href={href}
        style={surfaceStyle}
      >
        {inner}
      </MarbleLink>
    );
  }

  return (
    <div
      className={surfaceClassName}
      style={surfaceStyle}
      {...props}
    >
      {inner}
    </div>
  );
};

export type MarbleCardHeaderAction = MarbleButtonProps & {
  id?: string;
};

export type MarbleCardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  actions?: MarbleCardHeaderAction[];
  disclosureActions?: MarbleContextPopoverItem[];
  disclosureAriaLabel?: string;
  disclosureHeader?: ReactNode;
  disclosureMenuClassName?: string;
  disclosureTriggerClassName?: string;
  divided?: boolean;
};

export const MarbleCardHeader = ({
  actions,
  children,
  className,
  disclosureActions,
  disclosureAriaLabel = "Open card actions",
  disclosureHeader,
  disclosureMenuClassName,
  disclosureTriggerClassName,
  divided,
  ...props
}: MarbleCardHeaderProps) => {
  const hasHeaderActions =
    Boolean(actions?.length) || Boolean(disclosureActions?.length);

  if (!hasHeaderActions) {
    return (
      <div
        className={cx(
          marbleCardHeaderVariants({
            divided,
          }),
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cx(
        marbleCardHeaderVariants({
          divided,
        }),
        "gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className={marbleCardHeaderTextVariants()}>{children}</div>
      <div className={marbleCardHeaderActionsVariants()}>
        {actions?.map(
          ({ id, size = "sm", type = "button", ...action }, index) => (
            <MarbleButton
              key={id ?? `card-action-${index}`}
              size={size}
              type={type}
              {...action}
            />
          ),
        )}
        {disclosureActions?.length ? (
          <MarbleContextPopover
            ariaLabel={disclosureAriaLabel}
            header={disclosureHeader}
            items={disclosureActions}
            menuClassName={disclosureMenuClassName}
            triggerClassName={cx(
              "size-7 text-zinc-300 hover:bg-transparent hover:text-zinc-500",
              disclosureTriggerClassName,
            )}
          />
        ) : null}
      </div>
    </div>
  );
};

export type MarbleCardContentProps = HTMLAttributes<HTMLDivElement>;

export const MarbleCardContent = ({
  children,
  className,
  ...props
}: MarbleCardContentProps) => {
  return (
    <div
      className={cx(marbleCardContentVariants(), className)}
      {...props}
    >
      {children}
    </div>
  );
};

export type MarbleCardSectionProps = HTMLAttributes<HTMLElement>;

export const MarbleCardSection = ({
  children,
  className,
  ...props
}: MarbleCardSectionProps) => {
  return (
    <section
      className={cx(marbleCardSectionVariants(), className)}
      {...props}
    >
      {children}
    </section>
  );
};

export type MarbleCardFooterProps = HTMLAttributes<HTMLDivElement>;

export const MarbleCardFooter = ({
  children,
  className,
  ...props
}: MarbleCardFooterProps) => {
  return (
    <div
      className={cx(marbleCardFooterVariants(), className)}
      {...props}
    >
      {children}
    </div>
  );
};

export type MarbleCardTitleProps = HTMLAttributes<HTMLHeadingElement>;

export const MarbleCardTitle = ({
  children,
  className,
  ...props
}: MarbleCardTitleProps) => {
  return (
    <h2
      className={cx(marbleCardTitleVariants(), className)}
      {...props}
    >
      {children}
    </h2>
  );
};

export type MarbleCardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const MarbleCardDescription = ({
  children,
  className,
  ...props
}: MarbleCardDescriptionProps) => {
  return (
    <p
      className={cx(marbleCardDescriptionVariants(), className)}
      {...props}
    >
      {children}
    </p>
  );
};
