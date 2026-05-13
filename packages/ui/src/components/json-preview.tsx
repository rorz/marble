import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

const JSON_TOKEN =
  /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

const marbleJsonPreviewVariants = cva(
  "overflow-auto whitespace-pre-wrap break-words rounded-xs border bg-zinc-50 font-mono leading-5 text-zinc-700",
  {
    defaultVariants: {
      size: "md",
    },
    variants: {
      size: {
        md: "px-3 py-3 text-xs",
        sm: "px-3 py-2 text-[11px]",
      },
    },
  },
);

// harness-ignore: no-tokenize-json-helper -- MarbleJsonPreview is the canonical home for the JSON tokenizer; consumers must not re-implement it.
const tokenizeJson = (json: string): ReactNode[] => {
  const parts = json.split(JSON_TOKEN);

  return parts.map((part, index) => {
    if (index % 2 === 0) {
      return part;
    }

    let className = "text-sky-700";

    if (part.startsWith('"')) {
      className = part.endsWith(":")
        ? "text-zinc-900 font-medium"
        : "text-emerald-700";
    } else if (part === "true" || part === "false") {
      className = "text-violet-600";
    } else if (part === "null") {
      className = "text-zinc-400";
    }

    return (
      <span
        className={className}
        // biome-ignore lint/suspicious/noArrayIndexKey: deterministic JSON tokenization
        key={`${index}:${part.slice(0, 12)}`}
      >
        {part}
      </span>
    );
  });
};

const stringifyValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export type MarbleJsonPreviewProps = Omit<
  HTMLAttributes<HTMLPreElement>,
  "children"
> &
  VariantProps<typeof marbleJsonPreviewVariants> & {
    borderClassName?: string;
    value: unknown;
  };

export const MarbleJsonPreview = ({
  borderClassName = "border-zinc-200",
  className,
  size,
  value,
  ...props
}: MarbleJsonPreviewProps) => {
  const json = stringifyValue(value);
  const tokens = tokenizeJson(json); // harness-ignore: no-tokenize-json-helper -- internal use within the primitive that owns this helper.

  return (
    <pre
      className={cx(
        marbleJsonPreviewVariants({
          size,
        }),
        borderClassName,
        className,
      )}
      {...props}
    >
      {tokens}
    </pre>
  );
};
