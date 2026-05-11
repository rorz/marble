import { cx } from "@marble/ui";
import type { ReactNode } from "react";

/**
 * Schematic flow diagram primitives — pure CSS, no SVG. For sketching
 * relationships between concepts (e.g. "Table → Column → Program").
 * Renders as a horizontal flex row on md+ and stacks vertically below.
 */

type MarketingDiagramProps = {
  children: ReactNode;
  className?: string;
};

export function MarketingDiagram({
  children,
  className,
}: MarketingDiagramProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

const NODE_TONES = {
  cream: "border-taupe-700 bg-taupe-100 text-taupe-800",
  dark: "border-taupe-100/15 bg-taupe-800 text-taupe-100",
  light: "border-taupe-700 bg-taupe-200 text-taupe-800",
  orange: "border-orange-700 bg-orange-500 text-orange-50",
} as const;

type NodeTone = keyof typeof NODE_TONES;

type MarketingDiagramNodeProps = {
  /** Label / display text. */
  label: ReactNode;
  /** Eyebrow above the label. */
  eyebrow?: ReactNode;
  /** Body text below the label. */
  body?: ReactNode;
  /** Optional icon / glyph slot. */
  glyph?: ReactNode;
  tone?: NodeTone;
  /** Grow proportionally inside the diagram. */
  grow?: boolean;
  className?: string;
};

export function MarketingDiagramNode({
  label,
  eyebrow,
  body,
  glyph,
  tone = "cream",
  grow = true,
  className,
}: MarketingDiagramNodeProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-xs border-2 p-5 md:p-6",
        NODE_TONES[tone],
        grow && "flex-1",
        className,
      )}
    >
      {glyph ? <div className="text-current">{glyph}</div> : null}
      {eyebrow ? (
        <span className="font-mono text-eyebrow opacity-60">{eyebrow}</span>
      ) : null}
      <span className="font-display font-medium text-xl leading-tight tracking-tight md:text-2xl">
        {label}
      </span>
      {body ? <p className="text-sm opacity-70 md:text-base">{body}</p> : null}
    </div>
  );
}

/**
 * Connector arrow between two diagram nodes. Stacked CSS, no SVG — uses
 * a centered line + a chevron triangle.
 */
type MarketingDiagramArrowProps = {
  /** Visible label that sits on top of the arrow. */
  label?: ReactNode;
  /** Direction. */
  direction?: "right" | "down";
  className?: string;
};

export function MarketingDiagramArrow({
  label,
  direction = "right",
  className,
}: MarketingDiagramArrowProps) {
  if (direction === "down") {
    return (
      <div
        className={cx(
          "relative flex items-center justify-center self-center py-1",
          className,
        )}
      >
        <span className="h-8 w-0.5 bg-current/40" />
        <span className="-bottom-0.5 absolute size-2.5 rotate-45 border-current/40 border-r-2 border-b-2" />
        {label ? (
          <span className="-right-2 absolute top-1/2 translate-x-full -translate-y-1/2 font-mono text-eyebrow-xs opacity-60">
            {label}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cx(
        "relative flex flex-1 items-center justify-center px-1 md:flex-none md:px-3",
        className,
      )}
    >
      <span className="h-0.5 w-full bg-current/40 md:w-12" />
      <span className="-right-0.5 absolute size-2.5 rotate-45 border-current/40 border-t-2 border-r-2" />
      {label ? (
        <span className="-top-5 absolute font-mono text-eyebrow-xs opacity-60">
          {label}
        </span>
      ) : null}
    </div>
  );
}
