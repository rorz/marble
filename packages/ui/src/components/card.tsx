import { cva, type VariantProps } from "class-variance-authority";
import type { CSSProperties, HTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleCardNoiseTexture =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.62' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")";

const marbleCardVariants = cva(
  "relative isolate overflow-hidden rounded-xs border",
  {
    defaultVariants: {
      tone: "default",
    },
    variants: {
      tone: {
        default: "border-taupe-200 text-taupe-900",
        orange: "border-orange-200 text-zinc-950",
        subtle: "border-zinc-200 text-zinc-950",
      },
    },
  },
);

type MarbleCardTone = NonNullable<
  VariantProps<typeof marbleCardVariants>["tone"]
>;

const marbleCardSurfaceStyles: Record<MarbleCardTone, CSSProperties> = {
  default: {
    backgroundBlendMode: "screen, normal",
    backgroundColor: "var(--color-white)",
    backgroundImage: [
      "radial-gradient(140% 120% at 0% 0%, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0) 52%)",
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,245,240,0.97) 100%)",
    ].join(", "),
    backgroundRepeat: "no-repeat, no-repeat",
    backgroundSize: "100% 100%, 100% 100%",
  },
  orange: {
    backgroundBlendMode: "screen, normal",
    backgroundColor: "rgb(255 247 237)",
    backgroundImage: [
      "radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0) 48%)",
      "linear-gradient(135deg, rgba(255,247,237,1) 0%, rgba(255,255,255,0.95) 55%, rgba(255,251,245,1) 100%)",
    ].join(", "),
    backgroundRepeat: "no-repeat, no-repeat",
    backgroundSize: "100% 100%, 100% 100%",
  },
  subtle: {
    backgroundBlendMode: "screen, normal",
    backgroundColor: "rgb(250 250 250)",
    backgroundImage: [
      "radial-gradient(140% 120% at 0% 0%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 52%)",
      "linear-gradient(180deg, rgba(250,250,250,1) 0%, rgba(242,242,241,0.98) 100%)",
    ].join(", "),
    backgroundRepeat: "no-repeat, no-repeat",
    backgroundSize: "100% 100%, 100% 100%",
  },
};

const marbleCardNoiseStyles: Record<MarbleCardTone, CSSProperties> = {
  default: {
    backgroundImage: marbleCardNoiseTexture,
    backgroundRepeat: "repeat",
    backgroundSize: "160px 160px",
    mixBlendMode: "multiply",
    opacity: 0.14,
  },
  orange: {
    backgroundImage: marbleCardNoiseTexture,
    backgroundRepeat: "repeat",
    backgroundSize: "160px 160px",
    mixBlendMode: "multiply",
    opacity: 0.13,
  },
  subtle: {
    backgroundImage: marbleCardNoiseTexture,
    backgroundRepeat: "repeat",
    backgroundSize: "160px 160px",
    mixBlendMode: "multiply",
    opacity: 0.16,
  },
};

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
  style,
  ...props
}: MarbleCardProps) {
  const resolvedTone = tone ?? "default";

  return (
    <div
      className={cx(
        marbleCardVariants({
          tone: resolvedTone,
        }),
        className,
      )}
      style={{
        ...marbleCardSurfaceStyles[resolvedTone],
        ...style,
      }}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={marbleCardNoiseStyles[resolvedTone]}
      />
      <div className="relative z-10">{children}</div>
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
