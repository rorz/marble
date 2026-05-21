"use client";

import { MarbleButton, MarbleSpinner, MarbleTextarea } from "@marble/ui";
import { PaperPlaneRightIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
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

export const AgentChat = ({ headerActions }: AgentChatProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
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
    document.getElementById("agent-chat-composer")?.focus();
  }, []);

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
      <header className="flex items-center justify-between border-taupe-200 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-eyebrow-xs text-taupe-500 uppercase">
            Marble Agent
          </span>
        </div>
        <div className="flex items-center gap-1">
          <HistoryMenu
            activeThreadId={activeThreadId}
            disabled={streaming}
            onDeleteThread={handleDeleteThread}
            onSelectThread={handleSelectThread}
            threads={threadSummaries}
          />
          <button
            aria-label="New thread"
            className="flex size-8 items-center justify-center rounded-md text-taupe-500 transition-colors hover:bg-taupe-200/80 hover:text-taupe-900"
            onClick={handleNewThread}
            title="New thread"
            type="button"
          >
            <PlusIcon
              size={16}
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
          <div className="flex items-center gap-2 rounded-sm border border-taupe-200 bg-white/70 px-3 py-2 text-taupe-600 text-xs inset-shadow-2xs inset-shadow-white/45">
            <MarbleSpinner size="sm" />
            <div className="min-w-0 flex-1 space-y-1">
              <div>
                {status?.message ??
                  (elapsedMs === 0
                    ? "Connecting to Marble Agent..."
                    : elapsedMs < 5_000
                      ? "Marble Agent is thinking..."
                      : `Still working... ${Math.round(elapsedMs / 1000)}s`)}
              </div>
              {status?.notes.length ? (
                <div className="space-y-0.5 text-taupe-500">
                  {status.notes.map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              ) : null}
            </div>
            {elapsedMs > 15_000 ? (
              <span className="text-eyebrow-xs text-taupe-400 uppercase">
                long-running call
              </span>
            ) : null}
            <button
              aria-label="Cancel current run"
              className="flex size-7 shrink-0 items-center justify-center rounded-sm text-taupe-400 transition-colors hover:bg-taupe-100 hover:text-taupe-900"
              onClick={cancelCurrentRun}
              title="Cancel current run"
              type="button"
            >
              <XIcon
                size={14}
                weight="bold"
              />
            </button>
          </div>
        ) : null}
      </div>

      <form
        className="border-taupe-200 border-t bg-white/60 p-3"
        onSubmit={handleSubmit}
      >
        <div className="flex w-full items-end gap-2">
          <MarbleTextarea
            className="max-h-40 min-h-10 w-full resize-y"
            disabled={streaming}
            id="agent-chat-composer"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask Marble Agent..."
            value={draft}
          />
          <MarbleButton
            disabled={streaming || draft.trim().length === 0}
            iconLeft={PaperPlaneRightIcon}
            type="submit"
            variant="dark"
          >
            Send
          </MarbleButton>
        </div>
      </form>
    </section>
  );
};

export { AgentChatProvider } from "./context";
export { AgentChatCue } from "./cue";
