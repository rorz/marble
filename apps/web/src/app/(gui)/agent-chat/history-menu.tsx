"use client";

import { MarbleContextPopover, MarbleListRow } from "@marble/ui";
import { ClockIcon, TrashIcon } from "@phosphor-icons/react";
import type { ChatThreadSummary } from "./types";

type HistoryMenuProps = {
  activeThreadId: string;
  disabled?: boolean;
  onDeleteThread: (threadId: string) => void;
  onSelectThread: (threadId: string) => void;
  threads: ChatThreadSummary[];
};

const formatThreadUpdatedAt = (updatedAt: number) => {
  const timestamp = Number.isFinite(updatedAt) ? updatedAt : Date.now();
  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
};

export const HistoryMenu = ({
  activeThreadId,
  disabled = false,
  onDeleteThread,
  onSelectThread,
  threads,
}: HistoryMenuProps) => (
  <MarbleContextPopover
    align="end"
    ariaLabel="Open chat history"
    asChild
    content={
      <div className="w-80">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-sm text-taupe-950">
              Chat history
            </div>
            <div className="text-taupe-500 text-xs">Saved on this browser.</div>
          </div>
        </div>

        {threads.length === 0 ? (
          <div className="rounded-xs border border-taupe-200 bg-taupe-50 px-3 py-2 text-taupe-500 text-xs">
            No saved chats yet.
          </div>
        ) : (
          <div className="-mx-3 -mb-3 max-h-96 overflow-y-auto border-t border-taupe-200">
            {threads.map((thread) => (
              <MarbleListRow
                active={thread.id === activeThreadId}
                aside={
                  <button
                    aria-label={`Delete ${thread.title}`}
                    className="flex size-7 items-center justify-center rounded-sm text-taupe-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteThread(thread.id);
                    }}
                    title="Delete chat"
                    type="button"
                  >
                    <TrashIcon
                      size={14}
                      weight="bold"
                    />
                  </button>
                }
                description={formatThreadUpdatedAt(thread.updatedAt)}
                disabled={disabled}
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                size="sm"
                title={thread.title}
              />
            ))}
          </div>
        )}
      </div>
    }
  >
    <button
      aria-label="Open chat history"
      className="flex size-8 items-center justify-center rounded-md text-taupe-500 transition-colors hover:bg-taupe-200/80 hover:text-taupe-900"
      title="Chat history"
      type="button"
    >
      <ClockIcon
        size={16}
        weight="bold"
      />
    </button>
  </MarbleContextPopover>
);
