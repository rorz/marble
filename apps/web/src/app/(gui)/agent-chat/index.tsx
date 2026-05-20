// harness-ignore: max-file-lines -- single dense chat state machine; the
// stream consumer, watchdog, and event handlers share tightly coupled refs
// and would lose meaning if fragmented. Lift only if a second consumer
// materializes for the same orchestration.
"use client";

import { MarbleButton, MarbleSpinner, MarbleTextarea } from "@marble/ui";
import { PaperPlaneRightIcon, PlusIcon } from "@phosphor-icons/react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ChatEntryView } from "./entry-view";
import {
  type ChatEntry,
  IDLE_WATCHDOG_MS,
  type ParseOutcome,
  STORAGE_KEY,
  type StreamEvent,
} from "./types";

const loadEntries = (): ChatEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveEntries = (entries: ChatEntry[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
};

const randomId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const parseStreamEvent = (block: string): ParseOutcome => {
  if (!block.trim())
    return {
      kind: "ignored",
    };
  if (!block.startsWith("data: "))
    return {
      kind: "ignored",
    };
  const payload = block.slice(6);
  try {
    return {
      event: JSON.parse(payload) as StreamEvent,
      kind: "ok",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      kind: "parse_error",
      raw: payload,
    };
  }
};

type AgentChatProps = {
  headerActions?: ReactNode;
};

export const AgentChat = ({ headerActions }: AgentChatProps) => {
  // `entries` is hydrated from localStorage post-mount to avoid an SSR/CSR
  // mismatch (server has no storage; client does). `hydrated` gates the save
  // effect so it does not wipe localStorage with `[]` before the load runs.
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const lastUserMessageRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeAssistantIdRef = useRef<null | string>(null);
  const activeToolMapRef = useRef(new Map<string, string>());
  const abortRef = useRef<AbortController | null>(null);
  const sessionResolvedRef = useRef<boolean>(false);

  useEffect(() => {
    setEntries(loadEntries());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveEntries(entries);
  }, [
    entries,
    hydrated,
  ]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  });

  useEffect(() => {
    document.getElementById("agent-chat-composer")?.focus();
  }, []);

  const handleEvent = useCallback((event: StreamEvent) => {
    if (event.type === "marble_session_heartbeat") {
      if (typeof event.elapsedMs === "number") {
        setElapsedMs(event.elapsedMs);
      }
      return;
    }
    if (
      event.type === "marble_session_complete" ||
      event.type === "marble_session_error"
    ) {
      sessionResolvedRef.current = true;
    }
    setEntries((prev) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent?.type === "text_delta"
      ) {
        const delta = event.assistantMessageEvent.delta ?? "";
        const activeId = activeAssistantIdRef.current;
        if (activeId) {
          return prev.map((entry) =>
            entry.id === activeId && entry.kind === "assistant"
              ? {
                  ...entry,
                  content: entry.content + delta,
                }
              : entry,
          );
        }
        const newId = randomId();
        activeAssistantIdRef.current = newId;
        return [
          ...prev,
          {
            content: delta,
            id: newId,
            kind: "assistant",
            streaming: true,
          },
        ];
      }

      if (event.type === "message_end") {
        const activeId = activeAssistantIdRef.current;
        activeAssistantIdRef.current = null;
        return prev.map((entry) =>
          entry.id === activeId && entry.kind === "assistant"
            ? {
                ...entry,
                streaming: false,
              }
            : entry,
        );
      }

      if (event.type === "tool_execution_start" && event.toolCallId) {
        const newId = randomId();
        activeToolMapRef.current.set(event.toolCallId, newId);
        return [
          ...prev,
          {
            id: newId,
            kind: "tool",
            label: event.label ?? event.toolName ?? "Tool call",
            params: event.parameters,
            status: "pending",
            toolName: event.toolName ?? "unknown",
          },
        ];
      }

      if (event.type === "tool_execution_end" && event.toolCallId) {
        const toolEntryId = activeToolMapRef.current.get(event.toolCallId);
        activeToolMapRef.current.delete(event.toolCallId);
        if (!toolEntryId) return prev;
        return prev.map((entry) =>
          entry.id === toolEntryId && entry.kind === "tool"
            ? {
                ...entry,
                error: event.isError
                  ? typeof event.message === "string"
                    ? event.message
                    : "Tool failed"
                  : undefined,
                result: event.result,
                status: event.isError ? "error" : "complete",
              }
            : entry,
        );
      }

      if (event.type === "marble_session_error") {
        const inFlightToolIds = new Set(activeToolMapRef.current.values());
        activeToolMapRef.current.clear();
        activeAssistantIdRef.current = null;
        const closedOut = prev.map((entry) => {
          if (entry.kind === "assistant" && entry.streaming) {
            return {
              ...entry,
              streaming: false,
            };
          }
          if (
            entry.kind === "tool" &&
            entry.status === "pending" &&
            inFlightToolIds.has(entry.id)
          ) {
            return {
              ...entry,
              error: "Agent session failed before this tool returned.",
              status: "error" as const,
            };
          }
          return entry;
        });
        return [
          ...closedOut,
          {
            code: event.code,
            id: randomId(),
            kind: "error",
            message: event.message ?? "Agent session failed.",
          },
        ];
      }

      if (event.type === "marble_session_warnings") {
        if (!event.skipped || event.skipped.length === 0) return prev;
        return [
          ...prev,
          {
            id: randomId(),
            kind: "warning",
            message: `${event.skipped.length} tool${event.skipped.length === 1 ? "" : "s"} unavailable in this session.`,
            skipped: event.skipped,
          },
        ];
      }

      if (event.type === "marble_session_complete") {
        return prev;
      }

      return prev;
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      setEntries((prev) => [
        ...prev,
        {
          content: trimmed,
          id: randomId(),
          kind: "user",
        },
      ]);
      setDraft("");
      setStreaming(true);
      setElapsedMs(0);
      lastUserMessageRef.current = trimmed;
      sessionResolvedRef.current = false;
      activeAssistantIdRef.current = null;
      activeToolMapRef.current.clear();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/agent/chat", {
          body: JSON.stringify({
            message: trimmed,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const responseText = await response
            .text()
            .catch(() => "(empty response)");
          setEntries((prev) => [
            ...prev,
            {
              code: "TRANSPORT_FAILED",
              id: randomId(),
              kind: "error",
              message: `Chat request failed (HTTP ${response.status} ${response.statusText || "error"}): ${responseText.slice(0, 400)}`,
            },
          ]);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let watchdogFired = false;
        let lastActivityAt = Date.now();
        const watchdog = window.setInterval(() => {
          if (
            !watchdogFired &&
            Date.now() - lastActivityAt > IDLE_WATCHDOG_MS
          ) {
            watchdogFired = true;
            setEntries((prev) => [
              ...prev,
              {
                id: randomId(),
                kind: "warning",
                message: `No response from the agent for ${Math.round(IDLE_WATCHDOG_MS / 1000)}s. The model or a tool may be hanging. You can keep waiting or start a new thread.`,
              },
            ]);
          }
        }, 5000);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            lastActivityAt = Date.now();
            buffer += decoder.decode(value, {
              stream: true,
            });
            const blocks = buffer.split("\n\n");
            buffer = blocks.pop() ?? "";
            for (const block of blocks) {
              const outcome = parseStreamEvent(block);
              if (outcome.kind === "ok") {
                lastActivityAt = Date.now();
                handleEvent(outcome.event);
              } else if (outcome.kind === "parse_error") {
                setEntries((prev) => [
                  ...prev,
                  {
                    code: "STREAM_PARSE_FAILED",
                    id: randomId(),
                    kind: "error",
                    message: `Stream parse error: ${outcome.error}. Raw chunk: ${outcome.raw.slice(0, 200)}`,
                  },
                ]);
              }
            }
          }
        } finally {
          window.clearInterval(watchdog);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setEntries((prev) => [
          ...prev,
          {
            code: "TRANSPORT_FAILED",
            id: randomId(),
            kind: "error",
            message:
              error instanceof Error
                ? `Connection error: ${error.message}`
                : `Connection error: ${String(error)}`,
          },
        ]);
      } finally {
        if (!sessionResolvedRef.current && !controller.signal.aborted) {
          setEntries((prev) => [
            ...prev,
            {
              code: "STREAM_ABRUPT_END",
              id: randomId(),
              kind: "error",
              message:
                "The server stream closed without sending a completion or error event. The dev server terminal will have the upstream crash.",
            },
          ]);
        }
        setStreaming(false);
        activeAssistantIdRef.current = null;
        activeToolMapRef.current.clear();
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      handleEvent,
      streaming,
    ],
  );

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

  const handleNewThread = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setEntries([]);
    activeAssistantIdRef.current = null;
    activeToolMapRef.current.clear();
    document.getElementById("agent-chat-composer")?.focus();
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
        !entries.some((e) => e.kind === "assistant" && e.streaming) ? (
          <div className="flex items-center gap-2 rounded-sm border border-taupe-200 bg-white/70 px-3 py-2 text-taupe-600 text-xs inset-shadow-2xs inset-shadow-white/45">
            <MarbleSpinner size="sm" />
            <span className="flex-1">
              {elapsedMs === 0
                ? "Connecting to Marble Agent…"
                : elapsedMs < 5_000
                  ? "Marble Agent is thinking…"
                  : `Still working… ${Math.round(elapsedMs / 1000)}s`}
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
        <div className="flex items-end gap-2">
          <MarbleTextarea
            className="min-h-10 max-h-40 resize-y"
            disabled={streaming}
            id="agent-chat-composer"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask Marble Agent…"
            rows={2}
            value={draft}
          />
          <MarbleButton
            aria-label="Send"
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
