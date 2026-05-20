"use client";

import { MarbleButton, MarbleSpinner, MarbleTextarea } from "@marble/ui";
import { PaperPlaneRightIcon, PlusIcon } from "@phosphor-icons/react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

import { ChatEntryView } from "./entry-view";
import type { AgentChatPageContext } from "./types";
import { useSession } from "./use-session";

type AgentChatProps = {
  headerActions?: ReactNode;
  pageContext?: AgentChatPageContext;
};

export const AgentChat = ({ headerActions, pageContext }: AgentChatProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    draft,
    elapsedMs,
    entries,
    handleNewThread,
    sendMessage,
    setDraft,
    statusMessage,
    streaming,
  } = useSession({
    pageContext,
  });

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

  return (
    <section className="flex size-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-taupe-200 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-eyebrow-xs text-taupe-500 uppercase">
            Marble Agent
          </span>
        </div>
        <div className="flex items-center gap-1">
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

        {streaming &&
        (statusMessage ||
          !entries.some(
            (entry) =>
              entry.kind === "assistant" &&
              entry.streaming &&
              entry.content.length > 0,
          )) ? (
          <div className="flex items-center gap-2 rounded-sm border border-taupe-200 bg-white/70 px-3 py-2 text-taupe-600 text-xs inset-shadow-2xs inset-shadow-white/45">
            <MarbleSpinner size="sm" />
            <span className="flex-1">
              {statusMessage ??
                (elapsedMs === 0
                  ? "Connecting to Marble Agent..."
                  : elapsedMs < 5_000
                    ? "Marble Agent is thinking..."
                    : `Still working... ${Math.round(elapsedMs / 1000)}s`)}
            </span>
            {elapsedMs > 15_000 ? (
              <span className="text-eyebrow-xs text-taupe-400 uppercase">
                long-running call
              </span>
            ) : null}
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
