"use client";

import {
  ArrowUpIcon,
  BooksIcon,
  HeadsetIcon,
  type Icon,
  LightningIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

import { useAgentChatSession } from "./context";
import { ChatEntryView } from "./entry-view";
import { HistoryMenu } from "./history-menu";

type AgentChatProps = {
  headerActions?: ReactNode;
};

type TierKey = "expert" | "rapid" | "standard";

const TIER_META: Record<
  TierKey,
  {
    Icon: Icon;
    label: string;
  }
> = {
  expert: {
    Icon: BooksIcon,
    label: "Expert",
  },
  rapid: {
    Icon: LightningIcon,
    label: "Rapid",
  },
  standard: {
    Icon: HeadsetIcon,
    label: "Standard",
  },
};

const TierPill = ({ tier }: { tier: TierKey }) => {
  const { Icon: TierIcon, label } = TIER_META[tier];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-taupe-100 px-2 py-0.5 text-[11px] text-taupe-600">
      <TierIcon
        size={11}
        weight="duotone"
      />
      {label}
    </span>
  );
};

const TypingDots = () => (
  <span
    aria-hidden="true"
    className="flex items-center gap-1 text-taupe-400"
  >
    <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:0ms]" />
    <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:160ms]" />
    <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:320ms]" />
  </span>
);

export const AgentChat = ({ headerActions }: AgentChatProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    activeThreadId,
    cancelCurrentRun,
    draft,
    elapsedMs,
    entries,
    handleDeleteThread,
    handleNewThread,
    handleSelectThread,
    sendMessage,
    setDraft,
    status,
    streaming,
    threadSummaries,
  } = useAgentChatSession();

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const prevStreamingRef = useRef(streaming);
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = streaming;
    if (!wasStreaming || streaming) return;
    const active = document.activeElement;
    const interactive =
      active instanceof HTMLElement &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable);
    if (interactive && active !== textareaRef.current) return;
    textareaRef.current?.focus();
  }, [
    streaming,
  ]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  };
  const hasStreamingAssistantActivity = entries.some(
    (entry) =>
      entry.kind === "assistant" &&
      entry.streaming &&
      (entry.content.length > 0 || Boolean(entry.tools?.length)),
  );

  return (
    <section className="flex size-full min-h-0 flex-col">
      <header className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-eyebrow-xs text-taupe-400 uppercase">
          Marble Agent
        </span>
        <div className="flex items-center">
          <HistoryMenu
            activeThreadId={activeThreadId}
            disabled={streaming}
            onDeleteThread={handleDeleteThread}
            onSelectThread={handleSelectThread}
            threads={threadSummaries}
          />
          <button
            aria-label="New thread"
            className="flex size-7 items-center justify-center rounded-sm text-taupe-400 transition-colors hover:bg-taupe-100 hover:text-taupe-700"
            onClick={handleNewThread}
            title="New thread"
            type="button"
          >
            <PlusIcon
              size={14}
              weight="bold"
            />
          </button>
          {headerActions}
        </div>
      </header>

      <div
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        ref={scrollRef}
      >
        {entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-taupe-500">
            <p>Ask Marble Agent anything about your workspace.</p>
            <p className="text-xs text-taupe-400">
              Actions taken appear as system cards.
            </p>
          </div>
        ) : null}

        {entries.map((entry) => (
          <ChatEntryView
            entry={entry}
            key={entry.id}
          />
        ))}

        {streaming && !hasStreamingAssistantActivity ? (
          <div
            aria-label="Working"
            className="space-y-1 px-1 py-1 text-taupe-500 text-xs"
            role="status"
          >
            <div className="flex items-center gap-2">
              <TierPill tier={status?.tier ?? "rapid"} />
              <TypingDots />
              {status?.message ? (
                <span className="min-w-0 flex-1 truncate italic">
                  {status.message}
                </span>
              ) : (
                <span className="flex-1" />
              )}
              {elapsedMs > 15_000 ? (
                <span className="text-eyebrow-xs text-taupe-400 uppercase">
                  long-running
                </span>
              ) : null}
              <button
                aria-label="Cancel current run"
                className="flex size-6 shrink-0 items-center justify-center rounded-sm text-taupe-400 transition-colors hover:bg-taupe-100 hover:text-taupe-900"
                onClick={cancelCurrentRun}
                title="Cancel current run"
                type="button"
              >
                <XIcon
                  size={12}
                  weight="bold"
                />
              </button>
            </div>
            {status?.notes.length ? (
              <ul className="space-y-0.5 pl-1 text-[11px] text-taupe-400">
                {status.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end px-4 pb-1">
        <TierPill tier={status?.tier ?? "rapid"} />
      </div>

      <form
        className="px-4 pb-4"
        onSubmit={handleSubmit}
      >
        <div className="relative rounded-md border border-taupe-200 bg-white/60 transition-colors focus-within:border-taupe-300 focus-within:bg-white">
          <textarea
            className="block max-h-40 min-h-12 w-full resize-none bg-transparent px-3 py-2 pr-10 text-sm text-taupe-900 placeholder:text-taupe-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            disabled={streaming}
            id="agent-chat-composer"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask Marble Agent..."
            ref={textareaRef}
            rows={2}
            value={draft}
          />
          <button
            aria-label="Send message"
            className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full bg-taupe-900 text-white transition-colors hover:bg-taupe-700 disabled:cursor-not-allowed disabled:bg-taupe-200 disabled:text-taupe-400"
            disabled={streaming || draft.trim().length === 0}
            type="submit"
          >
            <ArrowUpIcon
              size={12}
              weight="bold"
            />
          </button>
        </div>
      </form>
    </section>
  );
};

export { AgentChatProvider } from "./context";
export { AgentChatCue } from "./cue";
