"use client";

import { CopyIcon } from "@phosphor-icons/react";
import { type ButtonHTMLAttributes, useEffect, useState } from "react";
import { cx } from "../utils/cx";

export type MarbleCopyFieldProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "value"
> & {
  copiedLabel?: string;
  copyLabel?: string;
  display?: "block" | "field";
  emptyLabel?: string;
  label: string;
  onCopy?: (value: string) => Promise<void> | void;
  value: null | string | undefined;
};

const writeClipboardText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.left = "-9999px";
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

export const MarbleCopyField = ({
  className,
  copiedLabel = "Copied",
  copyLabel = "Copy",
  disabled = false,
  display = "field",
  emptyLabel = "Not available",
  label,
  onCopy,
  value,
  ...props
}: MarbleCopyFieldProps) => {
  const [copied, setCopied] = useState(false);
  const hasValue = typeof value === "string" && value.length > 0;

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1400);

    return () => window.clearTimeout(timeout);
  }, [
    copied,
  ]);

  const handleCopy = async () => {
    if (typeof value !== "string" || value.length === 0) {
      return;
    }

    try {
      await writeClipboardText(value);
      await onCopy?.(value);
      setCopied(true);
    } catch (error) {
      console.error("Failed to copy value to clipboard.", error);
      setCopied(false);
    }
  };

  const blockDisplay = display === "block";

  return (
    <button
      className={cx(
        "group/copy-field flex w-full min-w-0 cursor-pointer flex-col rounded-xs border border-taupe-200 bg-white/80 text-left transition-colors hover:border-taupe-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50",
        blockDisplay ? "overflow-hidden" : "gap-2 px-3 py-3",
        className,
      )}
      disabled={disabled || !hasValue}
      onClick={() => void handleCopy()}
      type="button"
      {...props}
    >
      <span
        className={cx(
          "flex min-w-0 items-center justify-between gap-3",
          blockDisplay
            ? "border-taupe-200 border-b bg-taupe-50/80 px-3 py-2"
            : "",
        )}
      >
        <span className="min-w-0 truncate font-medium text-eyebrow-xs text-zinc-500">
          {label}
        </span>
        <span className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xs bg-taupe-100 px-1.5 py-0.5 font-medium text-eyebrow-xs text-taupe-700 transition-colors group-hover/copy-field:bg-taupe-200">
          <CopyIcon
            aria-hidden="true"
            size={11}
            weight="bold"
          />
          {copied ? copiedLabel : copyLabel}
        </span>
      </span>
      <span
        className={cx(
          "min-w-0 cursor-text select-text font-mono text-xs leading-5",
          blockDisplay
            ? "block max-h-40 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words px-3 py-3"
            : "break-all",
          hasValue ? "text-zinc-950" : "text-zinc-400",
        )}
      >
        {hasValue ? value : emptyLabel}
      </span>
    </button>
  );
};
