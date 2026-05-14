import { cx } from "@marble/ui";
import type { PropsWithChildren, ReactNode } from "react";

/**
 * Industrial panel — Teenage Engineering-style hardware faceplate. Has
 * decorative screw dots in the corners, registration marks, dotted
 * background grid, and an optional spec-line header.
 *
 * Pair with `MarketingKeypad`, `MarketingLCD`, and `MarketingDial` to
 * compose a faux-device.
 */

const TONES = {
  cream: "border-taupe-700 bg-taupe-200 text-taupe-900",
  dark: "border-taupe-900 bg-taupe-800 text-taupe-50",
  midnight: "border-taupe-900 bg-taupe-900 text-taupe-50",
  orange: "border-orange-800 bg-orange-500 text-orange-50",
} as const;

type Tone = keyof typeof TONES;

type MarketingPanelProps = PropsWithChildren<{
  tone?: Tone;
  /** Decorative top-line spec text ("EP-001 / KIT-01"). */
  spec?: ReactNode;
  /** Decorative top-right model label. */
  model?: ReactNode;
  /** Big optional title that sits on the panel as branding. */
  brand?: ReactNode;
  /** Suppress the dotted background grid. */
  flat?: boolean;
  /** Show the four screw dots in the corners. */
  screws?: boolean;
  /** Show the registration crosshair marks. */
  registration?: boolean;
  /** Subtle floating animation. */
  float?: boolean;
  className?: string;
}>;

const PanelScrew = ({ className }: { className?: string }) => {
  return (
    <span
      aria-hidden
      className={cx(
        "pointer-events-none absolute flex size-3 items-center justify-center rounded-full border border-current/30 bg-current/10",
        className,
      )}
    >
      <span className="block h-px w-2 rotate-45 bg-current/40" />
    </span>
  );
};

const PanelScrews = () => {
  return (
    <>
      <PanelScrew className="top-2 left-2" />
      <PanelScrew className="top-2 right-2" />
      <PanelScrew className="bottom-2 left-2" />
      <PanelScrew className="bottom-2 right-2" />
    </>
  );
};

const PanelCross = ({ className }: { className?: string }) => {
  return (
    <span
      aria-hidden
      className={cx(
        "pointer-events-none absolute flex size-3 items-center justify-center text-current/30",
        className,
      )}
    >
      <span className="absolute h-px w-3 bg-current" />
      <span className="absolute h-3 w-px bg-current" />
    </span>
  );
};

const PanelRegistration = () => {
  return (
    <>
      <PanelCross className="top-6 left-1/2 -translate-x-1/2" />
      <PanelCross className="right-6 bottom-1/3" />
    </>
  );
};

export const MarketingPanel = ({
  tone = "dark",
  spec,
  model,
  brand,
  flat = false,
  screws = true,
  registration = true,
  float = false,
  className,
  children,
}: MarketingPanelProps) => {
  const isDark = tone === "dark" || tone === "midnight";
  return (
    <div
      className={cx(
        "relative rounded-xs border-2 p-5 shadow-[8px_8px_0_0_rgba(0,0,0,0.18)] md:p-8",
        TONES[tone],
        !flat && (isDark ? "marketing-grid-bg" : "marketing-grid-bg-dark"),
        float && "animate-marketing-float",
        className,
      )}
    >
      {screws ? <PanelScrews /> : null}
      {registration ? <PanelRegistration /> : null}
      {spec || model || brand ? (
        <header
          className={cx(
            "mb-6 flex items-center justify-between gap-4 border-b border-current/15 pb-4",
          )}
        >
          {spec ? (
            <span className="flex items-center gap-2 font-mono text-eyebrow opacity-70">
              <span className="size-1.5 rounded-full bg-orange-500 animate-marketing-led" />
              {spec}
            </span>
          ) : (
            <span />
          )}
          {brand ? (
            <span className="font-display font-medium text-lg leading-none tracking-tight md:text-xl">
              {brand}
            </span>
          ) : null}
          {model ? (
            <span className="font-mono text-eyebrow opacity-60">{model}</span>
          ) : null}
        </header>
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
};

/**
 * Section divider inside a panel — a hairline rule with an optional
 * mono-text label sitting on top.
 */
export const MarketingPanelDivider = ({
  label,
  className,
}: {
  label?: ReactNode;
  className?: string;
}) => {
  return (
    <div className={cx("flex items-center gap-4", className)}>
      <span className="h-px flex-1 bg-current/15" />
      {label ? (
        <span className="font-mono text-eyebrow-xs opacity-60">{label}</span>
      ) : null}
      <span className="h-px flex-1 bg-current/15" />
    </div>
  );
};

/**
 * Spec-line label intended for use inside a panel — small, mono, and
 * paired with a colored dot. Use for sub-component identification (e.g.
 * "01 / DISPLAY", "FN-02 / TRIGGER").
 */
export const MarketingPanelLabel = ({
  children,
  index,
  className,
  dot = "orange",
}: PropsWithChildren<{
  index?: ReactNode;
  className?: string;
  dot?: "orange" | "cream" | "none";
}>) => {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 font-mono text-eyebrow-xs uppercase opacity-70",
        className,
      )}
    >
      {dot !== "none" ? (
        <span
          className={cx(
            "size-1.5 rounded-full",
            dot === "orange" ? "bg-orange-500" : "bg-current",
          )}
        />
      ) : null}
      {index !== undefined ? <span className="opacity-80">{index}</span> : null}
      <span>{children}</span>
    </span>
  );
};

/**
 * Speaker-grille decorative tile — used as a pure visual element inside
 * a panel. Pure dotted-circles pattern.
 */
export const MarketingPanelGrille = ({
  className,
  ratio = "16/5",
}: {
  className?: string;
  ratio?: string;
}) => {
  return (
    <div
      aria-hidden
      className={cx(
        "marketing-speaker-grille rounded-xs border border-current/20",
        className,
      )}
      style={{
        aspectRatio: ratio,
      }}
    />
  );
};
