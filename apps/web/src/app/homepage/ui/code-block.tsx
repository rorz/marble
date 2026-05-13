import { cx } from "@marble/ui";
import type { ReactNode } from "react";

/**
 * Marketing-styled code / terminal block. Has fake window chrome, large
 * monospace type. Distinct from `MarbleJsonPreview` which is compact and
 * app-facing.
 */

const TONES = {
  cream: "border-taupe-700 bg-taupe-100 text-taupe-800",
  dark: "border-taupe-900 bg-taupe-900 text-taupe-100",
  midnight: "border-taupe-900 bg-taupe-800 text-taupe-100",
} as const;

type Tone = keyof typeof TONES;

const SIZES = {
  lg: "text-base md:text-xl",
  md: "text-sm md:text-base",
  sm: "text-xs md:text-sm",
} as const;

type Size = keyof typeof SIZES;

type MarketingCodeBlockProps = {
  /** Optional chrome title — renders the fake-terminal title bar when set. */
  title?: ReactNode;
  /** Optional prompt-prefix prefixed to every visible line ("$ "). */
  prompt?: string;
  tone?: Tone;
  size?: Size;
  className?: string;
  /** Right-side action (e.g. "Copy"). Rendered into the title bar. */
  trailing?: ReactNode;
  children: ReactNode;
};

export const MarketingCodeBlock = ({
  title,
  prompt,
  tone = "dark",
  size = "md",
  className,
  trailing,
  children,
}: MarketingCodeBlockProps) => {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-xs border-2 shadow-[6px_6px_0_0_var(--color-orange-500)]",
        TONES[tone],
        className,
      )}
    >
      {title || trailing ? (
        <header className="flex items-center justify-between gap-3 border-b-2 border-current/20 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-current/30" />
            <span className="size-2.5 rounded-full bg-current/30" />
            <span className="size-2.5 rounded-full bg-current/30" />
            {title ? (
              <span className="ml-2 font-mono text-eyebrow opacity-60">
                {title}
              </span>
            ) : null}
          </div>
          {trailing ? (
            <div className="font-mono text-eyebrow opacity-60">{trailing}</div>
          ) : null}
        </header>
      ) : null}
      <pre
        className={cx(
          "overflow-x-auto px-5 py-5 font-mono leading-relaxed md:px-7 md:py-6",
          SIZES[size],
        )}
      >
        {prompt ? (
          <PromptedChildren prompt={prompt}>{children}</PromptedChildren>
        ) : (
          <code>{children}</code>
        )}
      </pre>
    </div>
  );
};

const PromptedChildren = ({
  prompt,
  children,
}: {
  prompt: string;
  children: ReactNode;
}) => {
  if (typeof children !== "string") {
    return <code>{children}</code>;
  }
  const lines = children.split("\n");
  return (
    <code className="block">
      {lines.map((line, index) => (
        <span
          className="block"
          // biome-ignore lint/suspicious/noArrayIndexKey: stable pre-split lines
          key={index}
        >
          <span className="select-none pr-3 text-orange-400">{prompt}</span>
          <span>{line}</span>
        </span>
      ))}
    </code>
  );
};

/**
 * Inline highlight inside a `MarketingCodeBlock`. Use it for keywords or
 * token emphasis like `marble init` → highlight `marble`.
 */
export const MarketingCodeMark = ({
  children,
  tone = "orange",
}: {
  children: ReactNode;
  tone?: "orange" | "cream";
}) => {
  return (
    <span
      className={cx(tone === "orange" ? "text-orange-400" : "text-taupe-200")}
    >
      {children}
    </span>
  );
};
