"use client";

import { MarbleJsonPreview, MarbleSpinner } from "@marble/ui";
import { WarningIcon, WrenchIcon } from "@phosphor-icons/react";
import { useState } from "react";
import {
  type ChatEntry,
  ERROR_CODE_DESCRIPTIONS,
  type ToolChatEntry,
} from "./types";

const formatToolLabel = (label: string) => {
  if (!label.includes("_")) return label;
  const raw = label.toLowerCase().replace(/^marble_/, "");
  return raw
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
};

const ToolEntryView = ({
  entry,
  nested = false,
}: {
  entry: ToolChatEntry;
  nested?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);

  const toneClass =
    entry.status === "error"
      ? "border-red-300 bg-red-50/60"
      : entry.status === "complete"
        ? "border-taupe-200 bg-white/80"
        : "border-taupe-200 bg-taupe-50/60";

  return (
    <div
      className={`rounded-sm border ${toneClass} ${nested ? "px-2 py-1.5" : "px-3 py-2"}`}
    >
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <WrenchIcon
          className={
            entry.status === "error"
              ? "text-red-500"
              : entry.status === "pending"
                ? "text-taupe-400"
                : "text-taupe-500"
          }
          size={14}
          weight="bold"
        />
        <span className="flex-1 truncate font-medium text-taupe-700 text-xs">
          {formatToolLabel(entry.label)}
        </span>
        {entry.status === "pending" ? <MarbleSpinner size="sm" /> : null}
        <span className="text-taupe-400 text-xs">
          {entry.status === "pending"
            ? "Running"
            : entry.status === "error"
              ? "Failed"
              : "Done"}
        </span>
      </button>

      {expanded ? (
        <div className="mt-2 space-y-2">
          <div>
            <p className="text-eyebrow-xs text-taupe-500 uppercase">Input</p>
            <MarbleJsonPreview value={entry.params} />
          </div>
          {entry.status === "complete" && entry.result !== undefined ? (
            <div>
              <p className="text-eyebrow-xs text-taupe-500 uppercase">Result</p>
              <MarbleJsonPreview value={entry.result} />
            </div>
          ) : null}
          {entry.status === "error" && entry.error ? (
            <div className="text-red-900 text-xs">{entry.error}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const AssistantEntryView = ({
  entry,
}: {
  entry: Extract<
    ChatEntry,
    {
      kind: "assistant";
    }
  >;
}) => (
  <div className="flex justify-start">
    <div className="max-w-[95%] space-y-2">
      {entry.tools && entry.tools.length > 0 ? (
        <div className="ml-2 space-y-1.5 border-taupe-200 border-l pl-2">
          {entry.tools.map((tool) => (
            <ToolEntryView
              entry={tool}
              key={tool.id}
              nested
            />
          ))}
        </div>
      ) : null}
      {entry.content ||
      (entry.streaming && (!entry.tools || entry.tools.length === 0)) ? (
        <div className="whitespace-pre-wrap rounded-sm px-3 py-2 text-sm text-taupe-900">
          {entry.content || (entry.streaming ? "Waiting for response..." : "")}
        </div>
      ) : null}
    </div>
  </div>
);

export const ChatEntryView = ({ entry }: { entry: ChatEntry }) => {
  if (entry.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-taupe-200 font-medium px-2.5 py-2 text-sm text-taupe-900">
          {entry.content}
        </div>
      </div>
    );
  }

  if (entry.kind === "assistant") {
    return <AssistantEntryView entry={entry} />;
  }

  if (entry.kind === "error") {
    const description = entry.code
      ? ERROR_CODE_DESCRIPTIONS[entry.code]
      : undefined;
    return (
      <div className="space-y-2 rounded-sm border border-red-300 bg-red-50/90 p-3 text-red-900 inset-shadow-2xs inset-shadow-white/45">
        <div className="flex items-start gap-2.5">
          <WarningIcon
            className="mt-0.5 shrink-0 text-red-600"
            size={18}
            weight="fill"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            {entry.code ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-xs bg-red-100 px-1.5 py-0.5 font-mono text-eyebrow-xs text-red-700 uppercase">
                  {entry.code}
                </span>
              </div>
            ) : null}
            {description ? (
              <div className="text-red-800 text-xs">{description}</div>
            ) : null}
            <div className="whitespace-pre-wrap break-words text-red-900 text-sm leading-snug">
              {entry.message}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (entry.kind === "warning") {
    return (
      <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
        <WarningIcon
          className="mt-0.5 shrink-0 text-amber-600"
          size={14}
          weight="duotone"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="whitespace-pre-wrap break-words">{entry.message}</div>
        </div>
      </div>
    );
  }

  return <ToolEntryView entry={entry} />;
};
