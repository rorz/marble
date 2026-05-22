import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "../utils/cx";

type Tone = "default" | "muted";

export type MarbleMarkdownProps = {
  /** Optional className applied to the outer wrapper. */
  className?: string;
  /** Markdown source. Safe to pass partial markdown — react-markdown re-parses on every render. */
  content: string;
  /** Visual tone. `default` is full-contrast body prose; `muted` is the dim, italic register used for AI thinking traces. */
  tone?: Tone;
};

type ToneTokens = {
  a: string;
  blockquote: string;
  codeBlock: string;
  codeInline: string;
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  hr: string;
  marker: string;
  preBlock: string;
  strong: string;
  td: string;
  th: string;
  wrapper: string;
};

const DEFAULT_TOKENS: ToneTokens = {
  a: "font-medium text-orange-600 underline-offset-2 hover:underline",
  blockquote: "border-taupe-300 border-l-2 pl-3 text-taupe-700 italic",
  codeBlock: "font-mono text-[12.5px]",
  codeInline:
    "rounded-xs border border-taupe-200 bg-taupe-50 px-1 py-px font-mono text-[12.5px] text-taupe-800",
  h1: "font-semibold text-base text-taupe-950",
  h2: "font-semibold text-[15px] text-taupe-950",
  h3: "font-semibold text-sm text-taupe-950",
  h4: "font-medium text-sm text-taupe-900",
  hr: "my-1 border-taupe-200",
  marker: "marker:text-taupe-500",
  preBlock:
    "overflow-x-auto rounded-xs border border-taupe-200 bg-taupe-50 p-2.5 font-mono text-[12.5px] text-taupe-800",
  strong: "font-semibold text-taupe-950",
  td: "border-taupe-200 border-b px-2 py-1 align-top",
  th: "border-taupe-200 border-b px-2 py-1 font-medium text-taupe-700",
  wrapper:
    "space-y-2 text-sm text-taupe-900 leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
};

const MUTED_TOKENS: ToneTokens = {
  a: "font-medium text-orange-500 underline-offset-2 hover:underline not-italic",
  blockquote: "border-taupe-200 border-l-2 pl-3 text-taupe-500",
  codeBlock: "font-mono text-[11px] not-italic",
  codeInline:
    "rounded-xs bg-taupe-100 px-1 py-px font-mono text-[11px] text-taupe-600 not-italic",
  h1: "font-semibold text-[13px] text-taupe-600 not-italic",
  h2: "font-semibold text-xs text-taupe-600 not-italic",
  h3: "font-semibold text-xs text-taupe-600 not-italic",
  h4: "font-medium text-xs text-taupe-600 not-italic",
  hr: "my-1 border-taupe-200",
  marker: "marker:text-taupe-400",
  preBlock:
    "overflow-x-auto rounded-xs bg-taupe-100 p-2 font-mono text-[11px] text-taupe-600 not-italic",
  strong: "font-semibold text-taupe-700 not-italic",
  td: "border-taupe-200 border-b px-2 py-1 align-top",
  th: "border-taupe-200 border-b px-2 py-1 font-medium text-taupe-600",
  wrapper:
    "space-y-1.5 text-xs italic text-taupe-500 leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
};

const TONE_TOKENS: Record<Tone, ToneTokens> = {
  default: DEFAULT_TOKENS,
  muted: MUTED_TOKENS,
};

const buildComponents = (tokens: ToneTokens): Components => ({
  a: ({ children, ...rest }) => (
    <a
      className={tokens.a}
      rel="noopener noreferrer"
      target="_blank"
      {...rest}
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className={tokens.blockquote}>{children}</blockquote>
  ),
  code: ({ children, className }) => {
    if (className?.startsWith("language-")) {
      return (
        <code className={cx(className, tokens.codeBlock)}>{children}</code>
      );
    }
    return <code className={tokens.codeInline}>{children}</code>;
  },
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h1 className={tokens.h1}>{children}</h1>,
  h2: ({ children }) => <h2 className={tokens.h2}>{children}</h2>,
  h3: ({ children }) => <h3 className={tokens.h3}>{children}</h3>,
  h4: ({ children }) => <h4 className={tokens.h4}>{children}</h4>,
  hr: () => <hr className={tokens.hr} />,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  ol: ({ children }) => (
    <ol className={cx("ml-5 list-decimal space-y-1", tokens.marker)}>
      {children}
    </ol>
  ),
  p: ({ children }) => <p>{children}</p>,
  pre: ({ children }) => <pre className={tokens.preBlock}>{children}</pre>,
  strong: ({ children }) => (
    <strong className={tokens.strong}>{children}</strong>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  td: ({ children }) => <td className={tokens.td}>{children}</td>,
  th: ({ children }) => <th className={tokens.th}>{children}</th>,
  ul: ({ children }) => (
    <ul className={cx("ml-5 list-disc space-y-1", tokens.marker)}>
      {children}
    </ul>
  ),
});

const COMPONENTS_BY_TONE: Record<Tone, Components> = {
  default: buildComponents(DEFAULT_TOKENS),
  muted: buildComponents(MUTED_TOKENS),
};

/**
 * Renders Markdown (GFM) inside Marble surfaces with project tone and spacing.
 *
 * Safe to use with streaming sources — react-markdown re-parses on every render,
 * so partial tokens (`**bo`) render harmlessly as plain text until they complete.
 *
 * `tone="default"` is full-contrast prose used for chat responses and authored copy.
 * `tone="muted"` is the dim, italic register used for AI thinking traces and other
 * deemphasised inline commentary.
 */
export const MarbleMarkdown = ({
  className,
  content,
  tone = "default",
}: MarbleMarkdownProps) => (
  <div className={cx(TONE_TOKENS[tone].wrapper, className)}>
    <Markdown
      components={COMPONENTS_BY_TONE[tone]}
      remarkPlugins={[
        remarkGfm,
      ]}
    >
      {content}
    </Markdown>
  </div>
);
