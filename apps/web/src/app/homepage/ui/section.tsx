import { cx } from "@marble/ui";
import type { PropsWithChildren, ReactNode } from "react";

const TONES = {
  cream: "bg-taupe-100 text-taupe-800",
  dark: "bg-taupe-700 text-taupe-100",
  darkest: "bg-taupe-800 text-taupe-100",
  light: "bg-taupe-200 text-taupe-700",
  mid: "bg-taupe-500 text-taupe-100",
  orange: "bg-orange-600 text-orange-50",
} as const;

type Tone = keyof typeof TONES;

const PADDING = {
  flush: "px-6 py-0",
  lg: "px-6 pt-36 pb-24",
  md: "px-6 pt-24 pb-20",
} as const;

type Padding = keyof typeof PADDING;

type SectionProps = PropsWithChildren<{
  tone?: Tone;
  padding?: Padding;
  className?: string;
  id?: string;
}>;

export const Section = ({
  tone = "mid",
  padding = "lg",
  className,
  id,
  children,
}: SectionProps) => {
  return (
    <section
      className={cx(PADDING[padding], TONES[tone], className)}
      id={id}
    >
      {children}
    </section>
  );
};

const HEADINGS = {
  display: "text-6xl md:text-8xl",
  lg: "text-4xl md:text-5xl",
  md: "text-3xl md:text-4xl",
  xl: "text-5xl md:text-7xl",
} as const;

type HeadingSize = keyof typeof HEADINGS;

const EYEBROW_TONES = {
  inherit: "opacity-70",
  orange: "text-orange-300",
  subtle: "opacity-50",
} as const;

type EyebrowTone = keyof typeof EYEBROW_TONES;

type SectionHeaderProps = {
  eyebrow?: ReactNode;
  eyebrowTone?: EyebrowTone;
  heading: ReactNode;
  lede?: ReactNode;
  size?: HeadingSize;
  align?: "start" | "center";
  className?: string;
};

export const SectionHeader = ({
  eyebrow,
  eyebrowTone = "inherit",
  heading,
  lede,
  size = "xl",
  align = "start",
  className,
}: SectionHeaderProps) => {
  return (
    <header
      className={cx(
        "flex max-w-4xl flex-col gap-6",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <span
          className={cx(
            "font-mono text-eyebrow-lg",
            EYEBROW_TONES[eyebrowTone],
          )}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={cx(
          "font-display font-medium leading-[0.95] tracking-tight",
          HEADINGS[size],
        )}
      >
        {heading}
      </h2>
      {lede ? (
        <p className="max-w-2xl text-lg opacity-80 md:text-xl">{lede}</p>
      ) : null}
    </header>
  );
};

type SectionInnerProps = PropsWithChildren<{
  className?: string;
  /** Max width clamp for content inside a section. */
  width?: "tight" | "normal" | "wide";
}>;

const WIDTHS = {
  normal: "max-w-6xl",
  tight: "max-w-4xl",
  wide: "max-w-7xl",
} as const;

export const SectionInner = ({
  width = "normal",
  className,
  children,
}: SectionInnerProps) => {
  return (
    <div className={cx("mx-auto w-full", WIDTHS[width], className)}>
      {children}
    </div>
  );
};
