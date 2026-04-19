import { cx } from "@marble/ui";
import type { PropsWithChildren, ReactNode } from "react";

const TONES = {
  dark: "bg-taupe-700 text-taupe-100",
  darkest: "bg-taupe-800 text-taupe-100",
  light: "bg-taupe-200 text-taupe-700",
  mid: "bg-taupe-500 text-taupe-100",
  orange: "bg-orange-600 text-orange-50",
} as const;

type Tone = keyof typeof TONES;

type SectionProps = PropsWithChildren<{
  tone?: Tone;
  className?: string;
}>;

export function Section({ tone = "mid", className, children }: SectionProps) {
  return (
    <section className={cx("px-6", "pt-36 pb-24", TONES[tone], className)}>
      {children}
    </section>
  );
}

const HEADINGS = {
  display: "text-6xl md:text-8xl",
  lg: "text-4xl md:text-5xl",
  md: "text-3xl md:text-4xl",
  xl: "text-5xl md:text-7xl",
} as const;

type HeadingSize = keyof typeof HEADINGS;

type SectionHeaderProps = {
  eyebrow?: ReactNode;
  heading: ReactNode;
  lede?: ReactNode;
  size?: HeadingSize;
  className?: string;
};

export function SectionHeader({
  eyebrow,
  heading,
  lede,
  size = "xl",
  className,
}: SectionHeaderProps) {
  return (
    <header className={`flex flex-col gap-6 max-w-4xl ${className ?? ""}`}>
      {eyebrow ? (
        <span className="font-mono text-xs uppercase tracking-[0.2em] opacity-70">
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={`font-display font-medium leading-[0.95] tracking-tight ${HEADINGS[size]}`}
      >
        {heading}
      </h2>
      {lede ? (
        <p className="text-lg md:text-xl opacity-80 max-w-2xl">{lede}</p>
      ) : null}
    </header>
  );
}
