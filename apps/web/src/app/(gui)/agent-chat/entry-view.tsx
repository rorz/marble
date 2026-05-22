"use client";

import { MarbleJsonPreview, MarbleMarkdown, MarbleSpinner } from "@marble/ui";
import {
  CaretDownIcon,
  CaretRightIcon,
  WarningIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
  type ChatEntry,
  ERROR_CODE_DESCRIPTIONS,
  type ToolChatEntry,
} from "./types";

const formatThinkingDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 1) return "<1s";
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
};

const StreamingIndicator = () => (
  <div
    aria-label="Working"
    className="ml-2 flex items-center gap-1 pt-1 text-taupe-400"
    role="status"
  >
    <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:0ms]" />
    <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:160ms]" />
    <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:320ms]" />
  </div>
);

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

const CollapsedSummary = ({
  children,
  expanded,
  onToggle,
}: {
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <button
    className="flex items-center gap-1.5 text-taupe-500 text-xs hover:text-taupe-700"
    onClick={onToggle}
    type="button"
  >
    {expanded ? (
      <CaretDownIcon
        size={10}
        weight="bold"
      />
    ) : (
      <CaretRightIcon
        size={10}
        weight="bold"
      />
    )}
    {children}
  </button>
);

const ThinkingBlock = ({
  collapsed,
  durationMs,
  thinking,
}: {
  collapsed: boolean;
  durationMs?: number;
  thinking: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  if (!collapsed) {
    return (
      <div className="ml-2 border-taupe-200 border-l pl-2">
        <MarbleMarkdown
          content={thinking}
          tone="muted"
        />
      </div>
    );
  }
  const label =
    durationMs !== undefined
      ? `Thought for ${formatThinkingDuration(durationMs)}`
      : "Thought for a moment";
  return (
    <div className="space-y-2">
      <CollapsedSummary
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      >
        <span className="italic">{label}</span>
      </CollapsedSummary>
      {expanded ? (
        <div className="ml-2 border-taupe-200 border-l pl-2">
          <MarbleMarkdown
            content={thinking}
            tone="muted"
          />
        </div>
      ) : null}
    </div>
  );
};

const ToolsBlock = ({
  collapsed,
  tools,
}: {
  collapsed: boolean;
  tools: ToolChatEntry[];
}) => {
  const [expanded, setExpanded] = useState(false);
  if (!collapsed) {
    return (
      <div className="ml-2 space-y-1.5 border-taupe-200 border-l pl-2">
        {tools.map((tool) => (
          <ToolEntryView
            entry={tool}
            key={tool.id}
            nested
          />
        ))}
      </div>
    );
  }
  const label =
    tools.length === 1 ? "Used 1 tool" : `Used ${tools.length} tools`;
  return (
    <div className="space-y-2">
      <CollapsedSummary
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      >
        <span>{label}</span>
      </CollapsedSummary>
      {expanded ? (
        <div className="ml-2 space-y-1.5 border-taupe-200 border-l pl-2">
          {tools.map((tool) => (
            <ToolEntryView
              entry={tool}
              key={tool.id}
              nested
            />
          ))}
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
}) => {
  const hasTools = Boolean(entry.tools && entry.tools.length > 0);
  const collapseAfterTurn = !entry.streaming;
  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] space-y-2">
        {entry.thinking ? (
          <ThinkingBlock
            collapsed={collapseAfterTurn}
            durationMs={entry.thinkingDurationMs}
            thinking={entry.thinking}
          />
        ) : null}
        {hasTools && entry.tools ? (
          <ToolsBlock
            collapsed={collapseAfterTurn}
            tools={entry.tools}
          />
        ) : null}
        {entry.content ? (
          <div className="rounded-sm px-3 py-2">
            <MarbleMarkdown content={entry.content} />
          </div>
        ) : entry.streaming && !entry.thinking && !hasTools ? (
          <div className="rounded-sm px-3 py-2 text-sm text-taupe-500 italic">
            Waiting for response...
          </div>
        ) : null}
        {entry.streaming ? <StreamingIndicator /> : null}
      </div>
    </div>
  );
};

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
